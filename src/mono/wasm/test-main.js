// Licensed to the .NET Foundation under one or more agreements.
// The .NET Foundation licenses this file to you under the MIT license.
// -*- mode: js; js-indent-level: 4; -*-
//
// Run runtime tests under a JS shell or a browser
//
"use strict";


/*****************************************************************************
 * Please don't use this as template for startup code.
 * There are simpler and better samples like src\mono\sample\wasm\browser\main.js
 * This one is not ES6 nor CJS, doesn't use top level await and has edge case polyfills. 
 * It handles strange things which happen with XHarness.
 ****************************************************************************/


//glue code to deal with the differences between chrome, ch, d8, jsc and sm.
const is_browser = typeof window != "undefined";
const is_node = !is_browser && typeof process === 'object' && typeof process.versions === 'object' && typeof process.versions.node === 'string';

if (is_node && process.versions.node.split(".")[0] < 14) {
    throw new Error(`NodeJS at '${process.execPath}' has too low version '${process.versions.node}'`);
}

if (typeof globalThis.crypto === 'undefined') {
    // **NOTE** this is a simple insecure polyfill for testing purposes only
    // /dev/random doesn't work on js shells, so define our own
    // See library_fs.js:createDefaultDevices ()
    globalThis.crypto = {
        getRandomValues: function (buffer) {
            for (let i = 0; i < buffer.length; i++)
                buffer[i] = (Math.random() * 256) | 0;
        }
    }
}

let v8args;
if (typeof arguments !== "undefined") {
    // this must be captured in top level scope in V8
    v8args = arguments;
}

async function getArgs() {
    let queryArguments = [];
    if (is_node) {
        queryArguments = process.argv.slice(2);
    } else if (is_browser) {
        // We expect to be run by tests/runtime/run.js which passes in the arguments using http parameters
        const url = new URL(decodeURI(window.location));
        let urlArguments = []
        for (let param of url.searchParams) {
            if (param[0] == "arg") {
                urlArguments.push(param[1]);
            }
        }
        queryArguments = urlArguments;
    } else if (v8args !== undefined) {
        queryArguments = Array.from(v8args);
    } else if (typeof scriptArgs !== "undefined") {
        queryArguments = Array.from(scriptArgs);
    } else if (typeof WScript !== "undefined" && WScript.Arguments) {
        queryArguments = Array.from(WScript.Arguments);
    }

    let runArgs;
    if (queryArguments.length > 0) {
        runArgs = processArguments(queryArguments);
    } else {
        const response = fetch('/runArgs.json')
        if (!response.ok) {
            console.debug(`could not load /args.json: ${response.status}. Ignoring`);
        }
        runArgs = await response.json();
    }
    runArgs = initRunArgs(runArgs);

    return runArgs;
}

function initRunArgs(runArgs) {
    // set defaults
    runArgs.applicationArguments = runArgs.applicationArguments === undefined ? [] : runArgs.applicationArguments;
    runArgs.profilers = runArgs.profilers === undefined ? [] : runArgs.profilers;
    runArgs.workingDirectory = runArgs.workingDirectory === undefined ? '/' : runArgs.workingDirectory;
    runArgs.environmentVariables = runArgs.environmentVariables === undefined ? {} : runArgs.environmentVariables;
    runArgs.runtimeArgs = runArgs.runtimeArgs === undefined ? [] : runArgs.runtimeArgs;
    runArgs.enableGC = runArgs.enableGC === undefined ? true : runArgs.enableGC;
    runArgs.diagnosticTracing = runArgs.diagnosticTracing === undefined ? false : runArgs.diagnosticTracing;
    runArgs.debugging = runArgs.debugging === undefined ? false : runArgs.debugging;
    runArgs.configSrc = runArgs.configSrc === undefined ? './mono-config.json' : runArgs.configSrc;
    // default'ing to true for tests, unless debugging
    runArgs.forwardConsole = runArgs.forwardConsole === undefined ? !runArgs.debugging : runArgs.forwardConsole;

    return runArgs;
}

function processArguments(incomingArguments) {
    const runArgs = initRunArgs({});

    console.log("Incoming arguments: " + incomingArguments.join(' '));
    while (incomingArguments && incomingArguments.length > 0) {
        const currentArg = incomingArguments[0];
        if (currentArg.startsWith("--profile=")) {
            const arg = currentArg.substring("--profile=".length);
            runArgs.profilers.push(arg);
        } else if (currentArg.startsWith("--setenv=")) {
            const arg = currentArg.substring("--setenv=".length);
            const parts = arg.split('=');
            if (parts.length != 2)
                set_exit_code(1, "Error: malformed argument: '" + currentArg);
            runArgs.environmentVariables[parts[0]] = parts[1];
        } else if (currentArg.startsWith("--runtime-arg=")) {
            const arg = currentArg.substring("--runtime-arg=".length);
            runArgs.runtimeArgs.push(arg);
        } else if (currentArg == "--disable-on-demand-gc") {
            runArgs.enableGC = false;
        } else if (currentArg == "--diagnostic-tracing") {
            runArgs.diagnosticTracing = true;
        } else if (currentArg.startsWith("--working-dir=")) {
            const arg = currentArg.substring("--working-dir=".length);
            runArgs.workingDirectory = arg;
        } else if (currentArg == "--debug") {
            runArgs.debugging = true;
        } else if (currentArg == "--no-forward-console") {
            runArgs.forwardConsole = false;
        } else if (currentArg.startsWith("--fetch-random-delay=")) {
            const arg = currentArg.substring("--fetch-random-delay=".length);
            if (is_browser) {
                const delayms = Number.parseInt(arg) || 100;
                const originalFetch = globalThis.fetch;
                globalThis.fetch = async (url, options) => {
                    // random sleep
                    const ms = delayms + (Math.random() * delayms);
                    console.log(`fetch ${url} started ${ms}`)
                    await new Promise(resolve => setTimeout(resolve, ms));
                    console.log(`fetch ${url} delayed ${ms}`)
                    const res = await originalFetch(url, options);
                    console.log(`fetch ${url} done ${ms}`)
                    return res;
                }
            } else {
                console.warn("--fetch-random-delay only works on browser")
            }
        } else if (currentArg.startsWith("--config-src=")) {
            const arg = currentArg.substring("--config-src=".length);
            runArgs.configSrc = arg;
        } else {
            break;
        }
        incomingArguments = incomingArguments.slice(1);
    }

    runArgs.applicationArguments = incomingArguments;
    // cheap way to let the testing infrastructure know we're running in a browser context (or not)
    runArgs.environmentVariables["IsBrowserDomSupported"] = is_browser.toString().toLowerCase();
    runArgs.environmentVariables["IsNodeJS"] = is_node.toString().toLowerCase();

    return runArgs;
}

// we may have dependencies on NPM packages, depending on the test case
// some of them polyfill for browser built-in stuff
function loadNodeModules(config, require, modulesToLoad) {
    modulesToLoad.split(',').forEach(module => {
        const { 0: moduleName, 1: globalAlias } = module.split(':');

        let message = `Loading npm '${moduleName}'`;
        let moduleExport = require(moduleName);

        if (globalAlias) {
            message += ` and attaching to global as '${globalAlias}'`;
            globalThis[globalAlias] = moduleExport;
        } else if (moduleName == "node-fetch") {
            message += ' and attaching to global';
            globalThis.fetch = moduleExport.default;
            globalThis.Headers = moduleExport.Headers;
            globalThis.Request = moduleExport.Request;
            globalThis.Response = moduleExport.Response;
        } else if (moduleName == "node-abort-controller") {
            message += ' and attaching to global';
            globalThis.AbortController = moduleExport.AbortController;
        }

        console.log(message);
    });
    // Must be after loading npm modules.
    config.environmentVariables["IsWebSocketSupported"] = ("WebSocket" in globalThis).toString().toLowerCase();
}

let mono_exit = (code, reason) => {
    console.log(`test-main failed early ${code} ${reason}`);
};

async function loadDotnet(file) {
    return await import(file);
}

const App = {
    /** Runs a particular test in legacy interop tests
     * @type {(method_name: string, args: any[]=, signature: any=) => return number}
     */
    call_test_method: function (method_name, args, signature) {
        // note: arguments here is the array of arguments passsed to this function
        if ((arguments.length > 2) && (typeof (signature) !== "string"))
            throw new Error("Invalid number of arguments for call_test_method");

        const fqn = "[System.Runtime.InteropServices.JavaScript.Legacy.UnitTests]System.Runtime.InteropServices.JavaScript.Tests.HelperMarshal:" + method_name;
        try {
            const method = App.runtime.BINDING.bind_static_method(fqn, signature);
            return method.apply(null, args || []);
        } catch (exc) {
            console.error("exception thrown in", fqn);
            throw exc;
        }
    },

    create_function(...args) {
        const code = args.pop();
        const arg_count = args.length;
        args.push("MONO");
        args.push("BINDING");
        args.push("INTERNAL");

        const userFunction = new Function(...args, code);
        return function (...args) {
            args[arg_count + 0] = globalThis.App.runtime.MONO;
            args[arg_count + 1] = globalThis.App.runtime.BINDING;
            args[arg_count + 2] = globalThis.App.runtime.INTERNAL;
            return userFunction(...args);
        };
    },

    invoke_js(js_code) {
        const closedEval = function (Module, MONO, BINDING, INTERNAL, code) {
            return eval(code);
        };
        const res = closedEval(globalThis.App.runtime.Module, globalThis.App.runtime.MONO, globalThis.App.runtime.BINDING, globalThis.App.runtime.INTERNAL, js_code);
        return (res === undefined || res === null || typeof res === "string")
            ? null
            : res.toString();
    }
};
globalThis.App = App; // Necessary as System.Runtime.InteropServices.JavaScript.Tests.MarshalTests (among others) call the App.call_test_method directly

async function run() {
    try {
        const { dotnet, exit, INTERNAL } = await loadDotnet('./dotnet.js');
        mono_exit = exit;

        const runArgs = await getArgs();
        if (runArgs.applicationArguments.length == 0) {
            mono_exit(1, "Missing required --run argument");
            return;
        }
        console.log("Application arguments: " + runArgs.applicationArguments.join(' '));

        dotnet
            .withVirtualWorkingDirectory(runArgs.workingDirectory)
            .withEnvironmentVariables(runArgs.environmentVariables)
            .withDiagnosticTracing(runArgs.diagnosticTracing)
            .withExitOnUnhandledError()
            .withExitCodeLogging()
            .withElementOnExit();

        if (is_node) {
            dotnet
                .withEnvironmentVariable("NodeJSPlatform", process.platform)
                .withAsyncFlushOnExit();

            const modulesToLoad = runArgs.environmentVariables["NPM_MODULES"];
            if (modulesToLoad) {
                dotnet.withModuleConfig({
                    onConfigLoaded: (config) => {
                        loadNodeModules(config, INTERNAL.require, modulesToLoad)
                    }
                })
            }
        }
        if (is_browser) {
            dotnet.withEnvironmentVariable("IsWebSocketSupported", "true");
        }
        if (runArgs.runtimeArgs.length > 0) {
            dotnet.withRuntimeOptions(runArgs.runtimeArgs);
        }
        if (runArgs.debugging) {
            dotnet.withDebugging(-1);
            dotnet.withWaitingForDebugger(-1);
        }
        if (runArgs.forwardConsole) {
            dotnet.withConsoleForwarding();
        }
        App.runtime = await dotnet.create();
        App.runArgs = runArgs

        console.info("Initializing.....");

        for (let i = 0; i < runArgs.profilers.length; ++i) {
            const init = App.runtime.Module.cwrap('mono_wasm_load_profiler_' + runArgs.profilers[i], 'void', ['string']);
            init("");
        }


        if (runArgs.applicationArguments[0] == "--regression") {
            const exec_regression = App.runtime.Module.cwrap('mono_wasm_exec_regression', 'number', ['number', 'string']);

            let res = 0;
            try {
                res = exec_regression(10, runArgs.applicationArguments[1]);
                console.log("REGRESSION RESULT: " + res);
            } catch (e) {
                console.error("ABORT: " + e);
                console.error(e.stack);
                res = 1;
            }

            if (res) mono_exit(1, "REGRESSION TEST FAILED");

            return;
        }

        if (runArgs.applicationArguments[0] == "--run") {
            // Run an exe
            if (runArgs.applicationArguments.length == 1) {
                mono_exit(1, "Error: Missing main executable argument.");
                return;
            }
            try {
                const main_assembly_name = runArgs.applicationArguments[1];
                const app_args = runArgs.applicationArguments.slice(2);
                const result = await App.runtime.runMain(main_assembly_name, app_args);
                mono_exit(result);
            } catch (error) {
                if (error.name != "ExitStatus") {
                    mono_exit(1, error);
                }
            }
        } else {
            mono_exit(1, "Unhandled argument: " + runArgs.applicationArguments[0]);
        }
    } catch (err) {
        mono_exit(1, err)
    }
}

run();