// Licensed to the .NET Foundation under one or more agreements.
// The .NET Foundation licenses this file to you under the MIT license.

using System.Collections.Generic;
using System.Globalization;
using System.Reflection;
using System.Reflection.Emit;
using System.Runtime.InteropServices.Tests.Common;
using Xunit;

namespace System.Runtime.InteropServices.Tests
{
    public class PtrToStructureTests
    {
        [Fact]
        public void StructureToPtr_NonGenericType_ReturnsExpected()
        {
            var structure = new SequentialClass
            {
                i = 10,
                s = "hello"
            };

            int size = Marshal.SizeOf(structure);
            IntPtr ptr = Marshal.AllocHGlobal(size);
            try
            {
                Marshal.StructureToPtr(structure, ptr, false);

                SequentialClass result = Assert.IsType<SequentialClass>(Marshal.PtrToStructure(ptr, typeof(SequentialClass)));
                Assert.Equal(10, result.i);
                Assert.Equal("hello", result.s);
            }
            finally
            {
                Marshal.DestroyStructure(ptr, structure.GetType());
                Marshal.FreeHGlobal(ptr);
            }
        }

        [Fact]
        public void StructureToPtr_GenericType_ReturnsExpected()
        {
            var structure = new SomeTestStruct
            {
                i = 10,
                s = "hello"
            };

            int size = Marshal.SizeOf(structure);
            IntPtr ptr = Marshal.AllocHGlobal(size);
            try
            {
                Marshal.StructureToPtr(structure, ptr, false);

                SomeTestStruct result = Marshal.PtrToStructure<SomeTestStruct>(ptr);
                Assert.Equal(10, result.i);
                Assert.Equal("hello", result.s);
            }
            finally
            {
                Marshal.FreeHGlobal(ptr);
            }
        }

        [Fact]
        public void StructureToPtr_NonGenericObject_ReturnsExpected()
        {
            var structure = new SomeTestStruct
            {
                i = 10,
                s = "hello"
            };

            int size = Marshal.SizeOf(structure);
            IntPtr ptr = Marshal.AllocHGlobal(size);
            try
            {
                Marshal.StructureToPtr(structure, ptr, false);

                var result = new SequentialClass();
                Marshal.PtrToStructure(ptr, (object)result);
                Assert.Equal(10, result.i);
                Assert.Equal("hello", result.s);
            }
            finally
            {
                Marshal.FreeHGlobal(ptr);
            }
        }

        [Fact]
        public void StructureToPtr_GenericObject_ReturnsExpected()
        {
            var structure = new SomeTestStruct
            {
                i = 10,
                s = "hello"
            };

            int size = Marshal.SizeOf(structure);
            IntPtr ptr = Marshal.AllocHGlobal(size);
            try
            {
                Marshal.StructureToPtr(structure, ptr, false);

                var result = new SequentialClass();
                Marshal.PtrToStructure(ptr, result);
                Assert.Equal(10, result.i);
                Assert.Equal("hello", result.s);
            }
            finally
            {
                Marshal.DestroyStructure(ptr, structure.GetType());
                Marshal.FreeHGlobal(ptr);
            }
        }

        [Fact]
        public void PtrToStructure_ZeroPointerWithType_ReturnsNull()
        {
            Assert.Null(Marshal.PtrToStructure(IntPtr.Zero, typeof(SomeTestStruct)));
            Assert.Null(Marshal.PtrToStructure<NonGenericClass>(IntPtr.Zero));
            Assert.Throws<NullReferenceException>(() => Marshal.PtrToStructure<SomeTestStruct>(IntPtr.Zero));
        }

        [Fact]
        public void PtrToStructure_ZeroPointer_ThrowsArgumentNullException()
        {
            AssertExtensions.Throws<ArgumentNullException>("ptr", () => Marshal.PtrToStructure(IntPtr.Zero, (object)new SomeTestStruct()));
            AssertExtensions.Throws<ArgumentNullException>("ptr", () => Marshal.PtrToStructure(IntPtr.Zero, new SomeTestStruct()));
        }

        [Fact]
        public void PtrToStructure_NullStructure_ThrowsArgumentNullException()
        {
            AssertExtensions.Throws<ArgumentNullException>("structure", () => Marshal.PtrToStructure((IntPtr)1, (object)null));
            AssertExtensions.Throws<ArgumentNullException>("structure", () => Marshal.PtrToStructure<object>((IntPtr)1, null));
        }

        [Fact]
        public void PtrToStructure_AutoLayoutClass_ThrowsArgumentException()
        {
            AssertExtensions.Throws<ArgumentException>("structure", () => Marshal.PtrToStructure((IntPtr)1, (object)new NonGenericClass()));
            AssertExtensions.Throws<ArgumentException>("structure", () => Marshal.PtrToStructure((IntPtr)1, new NonGenericClass()));
        }

        [Fact]
        public unsafe void PtrToStructure_GenericLayoutClass_Generic()
        {
            int i = 42;
            IntPtr ptr = (IntPtr)(&i);
            SequentialGenericClass<int> obj = new SequentialGenericClass<int>();
            Marshal.PtrToStructure(ptr, obj);
            Assert.Equal(i, obj.field);
        }

        [Fact]
        public unsafe void PtrToStructure_GenericLayoutClass()
        {
            int i = 42;
            IntPtr ptr = (IntPtr)(&i);
            SequentialGenericClass<int> obj = new SequentialGenericClass<int>();
            Marshal.PtrToStructure(ptr, (object)obj);
            Assert.Equal(i, obj.field);
        }

        public static IEnumerable<object[]> PtrToStructure_ObjectNotValueClass_TestData()
        {
            yield return new object[] { new NonGenericStruct() };
            yield return new object[] { Int32Enum.Value1 };
        }

        [Theory]
        [MemberData(nameof(PtrToStructure_ObjectNotValueClass_TestData))]
        public void PtrToStructure_ObjectNotValueClass_ThrowsArgumentException(object structure)
        {
            AssertExtensions.Throws<ArgumentException>("structure", () => Marshal.PtrToStructure((IntPtr)1, structure));
            AssertExtensions.Throws<ArgumentException>("structure", () => Marshal.PtrToStructure<object>((IntPtr)1, structure));
        }

        public static IEnumerable<object[]> PtrToStructure_ObjectNotBlittable_TestData()
        {
            yield return new object[] { new NonGenericClass() };
        }

        [Theory]
        [MemberData(nameof(PtrToStructure_ObjectNotBlittable_TestData))]
        public void PtrToStructure_ObjectNoBlittable_ThrowsArgumentException(object structure)
        {
            AssertExtensions.Throws<ArgumentException>("structure", () => Marshal.PtrToStructure((IntPtr)1, structure));
            AssertExtensions.Throws<ArgumentException>("structure", () => Marshal.PtrToStructure<object>((IntPtr)1, structure));
        }

        [Fact]
        public void PtrToStructure_NullStructureType_ThrowsArgumentNullException()
        {
            AssertExtensions.Throws<ArgumentNullException>("structureType", () => Marshal.PtrToStructure((IntPtr)1, null));
        }

        public static IEnumerable<object[]> PtrToStructure_GenericType_TestData()
        {
            yield return new object[] { typeof(GenericClass<string>) };
            yield return new object[] { typeof(GenericClass<>) };
            yield return new object[] { typeof(GenericStruct<string>) };
            yield return new object[] { typeof(GenericStruct<>) };
            yield return new object[] { typeof(IGenericInterface<string>) };
            yield return new object[] { typeof(IGenericInterface<>) };
        }

        [Theory]
        [MemberData(nameof(PtrToStructure_GenericType_TestData))]
        public void PtrToStructure_GenericType_ThrowsArgumentException(Type structureType)
        {
            AssertExtensions.Throws<ArgumentException>("structureType", () => Marshal.PtrToStructure((IntPtr)1, structureType));
        }

        [ConditionalFact(typeof(PlatformDetection), nameof(PlatformDetection.IsReflectionEmitSupported))]
        public void PtrToStructure_NonRuntimeType_ThrowsArgumentException()
        {
            AssemblyBuilder assemblyBuilder = AssemblyBuilder.DefineDynamicAssembly(new AssemblyName("Assembly"), AssemblyBuilderAccess.Run);
            ModuleBuilder moduleBuilder = assemblyBuilder.DefineDynamicModule("Module");
            TypeBuilder typeBuilder = moduleBuilder.DefineType("Type");
            AssertExtensions.Throws<ArgumentException>("structureType", "type", () => Marshal.PtrToStructure((IntPtr)1, (Type)typeBuilder));
        }

        public static IEnumerable<object[]> PtrToStructure_NonBlittableType_TestData()
        {
            yield return new object[] { typeof(AutoLayoutStruct) };
            yield return new object[] { typeof(NonGenericClass) };
            yield return new object[] { typeof(AbstractClass) };
        }

        [Theory]
        [MemberData(nameof(PtrToStructure_NonBlittableType_TestData))]
        public void PtrToStructure_NonBlittablType_ThrowsArgumentException(Type structureType)
        {
            AssertExtensions.Throws<ArgumentException>("structure", () => Marshal.PtrToStructure((IntPtr)1, structureType));
        }

        public static IEnumerable<object[]> PtrToStructure_CantCreateType_TestData()
        {
            yield return new object[] { typeof(GenericClass<>).GetTypeInfo().GenericTypeParameters[0], typeof(ArgumentException) };
            yield return new object[] { typeof(int).MakePointerType(), typeof(MissingMethodException) };
            yield return new object[] { typeof(int).MakeByRefType(), typeof(MissingMethodException) };
        }

        [Theory]
        [MemberData(nameof(PtrToStructure_CantCreateType_TestData))]
        public void PtrToStructure_CantCreateType_ThrowsArgumentException(Type structureType, Type exceptionType)
        {
            Assert.Throws(exceptionType, () => Marshal.PtrToStructure((IntPtr)1, structureType));
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct SomeTestStruct
        {
            public int i;
            public string s;
        }

        [StructLayout(LayoutKind.Auto)]
        public struct AutoLayoutStruct
        {
            public int i;
        }

        [StructLayout(LayoutKind.Sequential)]
        public class SequentialClass
        {
            internal SequentialClass()
            {
            }

            public int i;
            public string s;
        }

        public enum Int32Enum : int { Value1, Value2 }
    }
}
