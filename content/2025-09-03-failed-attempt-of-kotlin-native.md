---
title: Kotlin/Native 移植踩坑记
date: 2025-09-03
---

前段时间，鉴于 Linwenxuan 已经写过了[纯 Kotlin 的相关加密算法实现](https://github.com/LagrangeDev/lagrange-kotlin/tree/main/src/main/kotlin/org/lagrange/dev/utils/crypto)，想要把半成品的 [lagrange-kotlin](https://github.com/LagrangeDev/Lagrange-kotlin) 移植到 Kotlin/Native 平台，项目地址位于 [SaltifyDev/acidify](https://github.com/SaltifyDev/acidify)。在移植过程中，笔者进行了一些努力，但以失败告终，现记录过程如下。

> [!note]
>
> 在写下这篇文章不久后，笔者的移植工作受到了 [Linwenxuan 的无私协助](https://github.com/SaltifyDev/acidify/commit/5295a04e5a5a1537d57408ca5c8bec8246c483af)，他编写了纯 Kotlin 的高效 BigInt 实现，并且移植了 ECDH 算法，因而移植工作得以延续。笔者在此对 Linwenxuan 表示诚挚的感谢！
>
> 此文档仍然会保留，以记录笔者在移植过程中遇到的坑和寻找到的解决方案，供日后参考。

## 零反射的 Protobuf 框架

笔者利用 Kotlin 适用于编写 DSL 的特性，结合泛型编写了一个效率不是很高但不使用反射的 Protobuf 框架，大致的定义以及调用流程如下：

```kotlin
class PbObject<S>(val schema: S) {
    constructor(schema: S, inputBytes: ByteArray) {
        // read input bytes to tree
    }

    fun <T> get(supplier: S.() -> PbType<T>): T {
        // read value from tree
    }
}

object SomeSchema {
    val intField = PbInt32(1) // underlying type: PbType<Int>
    val stringField = PbString(2)
}

fun `extract intField from input`(input: ByteArray): Int {
    val pbObj = PbObject(SomeSchema, input)
    val intFieldValue = pbObj.get { intField }
    return intFieldValue
}
```

## Java 标准库的替代品

不得不说，Kotlin 的标准库远远没有 Java 的完善（一定程度上是因为大爹 JetBrains 太穷了）。但无论如何，笔者还是东拼西凑找到了一点能用的 Kotlin Multiplatform 库，下面是这个项目最后的 `libs.versions.toml`（节选）：

```toml
[libraries]
kotlinGradlePlugin = { module = "org.jetbrains.kotlin:kotlin-gradle-plugin", version.ref = "kotlin" }

kotlinxSerialization = { module = "org.jetbrains.kotlinx:kotlinx-serialization-json", version.ref = "kotlinxSerializationJSON" }
kotlinxCoroutines = { module = "org.jetbrains.kotlinx:kotlinx-coroutines-core", version.ref = "kotlinxCoroutines" }
kotlinxIO = { module = "org.jetbrains.kotlinx:kotlinx-io-core", version.ref = "kotlinxIO" }

ktorClientCore = { module = "io.ktor:ktor-client-core", version.ref = "ktor" }
ktorClientCIO = { module = "io.ktor:ktor-client-cio", version.ref = "ktor" }
ktorSerializationKotlinxJson = { module = "io.ktor:ktor-serialization-kotlinx-json", version.ref = "ktor" }

kmpBigNum = { module = "com.ionspin.kotlin:bignum", version.ref = "kmpBigNum" }

cryptoCore = { module = "dev.whyoleg.cryptography:cryptography-core", version.ref = "crypto" }
cryptoProviderOptimal = { module = "dev.whyoleg.cryptography:cryptography-provider-optimal", version.ref = "crypto" }

korlibsCompression = { module = "com.soywiz:korlibs-compression", version.ref = "korlibs" }

kermit = { module = "co.touchlab:kermit", version.ref = "kermit" }
```

值得一提的是，其中的 [`korlibs`](https://github.com/korlibs/korlibs) 源自 Kotlin 的游戏引擎 [KorGE](https://github.com/korlibs/korge)，包含全家桶级别的纯 Kotlin 实现的一些实用功能（尽管不知道可用性如何，Bug 有多少），不知道未来某天会不会被 JetBrains 招安。总之，在找齐了这么多实用工具之后，这个打满补丁的“恒河战舰”总算是能起航了。

## 插曲：Mac 的编译工具链

[Kotlin/Native 的官方文档](https://kotlinlang.org/docs/native-get-started.html) 提到：

> If you use a Mac and want to create and run applications for macOS or other Apple targets, you also need to install [Xcode Command Line Tools](https://developer.apple.com/download/), launch it, and accept the license terms first.

这其中的最后一句 "accept the license terms first" 非常重要。笔者在 Mac 上本身安装了 Xcode Command Line Tools，但在 link 阶段出现了报错，百思不得其解，最后在一篇博客上看到了必须要启动一次 Xcode 并且同意许可协议，才能继续运行，编译问题才算解决。

## ECDH 的效率问题

真正在移植代码的时候，还是出现了问题，因为 lagrange-kotlin 的 ECDH 实现依赖了 `java.math.BigInteger`，而 Kotlin 并未提供高效率的大整数标准库，移植再一次陷入了困境。笔者尝试了多个 BigInt 的实现（列表可见 [ObserverOfTime/kbigint 仓库的 Alternatives 章节](https://github.com/ObserverOfTime/kbigint)），其效率都不尽如人意，完成一次 ECDH 密钥交换的时间普遍在 ~10s。通过查阅更多的仓库，笔者发现了[可能的原因](https://github.com/SciProgCentre/kmath/issues/279)：现存的 Kotlin BigInt 的乘法算法实现的时间复杂度普遍在 `O(n^2)` 级别。笔者尝试依赖成品的 crypto library（例如 [cryptography-kotlin](https://github.com/whyoleg/cryptography-kotlin)），但其中的 ECDH 并不支持 `secp192k1` 这一曲线类型。

基于以上种种挫折，笔者的 Kotlin/Native 移植尝试只好作罢。或许我们需要等待更有钱的公司“收养” Kotlin，给它提供更高效更完善的标准库实现；或许我们只是需要等待社区发展，生长出越来越多的“野鸡”库；或许，Kotlin/Native 只不过是黄粱一梦，市面上有那么多天生支持 native 目标的语言，何必要吃这个“强扭的瓜”呢？
