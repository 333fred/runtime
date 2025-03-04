﻿// Licensed to the .NET Foundation under one or more agreements.
// The .NET Foundation licenses this file to you under the MIT license.

using System.Runtime.InteropServices;

namespace System.Transactions.DtcProxyShim.DtcInterfaces;

// https://docs.microsoft.com/previous-versions/windows/desktop/ms686489(v=vs.85)
[ComImport, Guid("6B369C21-FBD2-11d1-8F47-00C04F8EE57D"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IResourceManagerFactory2
{
    internal void Create(
        Guid pguidRM,
        [MarshalAs(UnmanagedType.LPStr)] string pszRMName,
        [MarshalAs(UnmanagedType.Interface)] IResourceManagerSink pIResMgrSink,
        [MarshalAs(UnmanagedType.Interface)] out IResourceManager rm);

    internal void CreateEx(
        Guid pguidRM,
        [MarshalAs(UnmanagedType.LPStr)] string pszRMName,
        [MarshalAs(UnmanagedType.Interface)] IResourceManagerSink pIResMgrSink,
        Guid riidRequested,
        [MarshalAs(UnmanagedType.Interface)] out object rm);
}
