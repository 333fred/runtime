// Licensed to the .NET Foundation under one or more agreements.
// The .NET Foundation licenses this file to you under the MIT license.

using System;
using Xunit;

[assembly: SkipOnPlatform(TestPlatforms.Browser, "System.Net.Requests is not supported on Browser.")]
[assembly: ActiveIssue("https://github.com/dotnet/runtime/issues/74795", typeof(PlatformDetection), nameof(PlatformDetection.IsMonoLinuxArm64))]
