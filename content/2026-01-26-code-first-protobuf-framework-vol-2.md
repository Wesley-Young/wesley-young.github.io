---
title: Code-First 的 Protobuf 框架（下）
date: 2026-01-26
---

[前篇文章](2025-12-26-code-first-protobuf-framework-vol-1)介绍了笔者用 TypeScript 编写的 Protobuf 框架 [typeproto](https://github.com/SaltifyDev/typeproto) 的主要设计思路和实现细节。本篇将讨论笔者用 Kotlin 编写的另一个 Protobuf 框架的设计思路。此框架尚未发布到 Maven Central，其源代码位于 [Acidify 项目](https://github.com/LagrangeDev/acidify/tree/main/acidify-core/src/commonMain/kotlin/org/ntqqrev/acidify/internal/protobuf)中。

## 基本用法

照例，我们先看一下如何使用这个库定义消息和进行序列化/反序列化：

```kotlin
import org.ntqqrev.acidify.internal.protobuf.*

object TestMessage : PbSchema() {
    val int32Field = PbInt32[1]
    val boolField = PbBoolean[2]
    val optionalField = PbOptional[PbInt32[3]]
}

val message = TestMessage {
    it[int32Field] = 1
    it[boolField] = true
    it[optionalField] = null
}

val encoded = message.toByteArray()
val decoded = TestMessage(encoded)
val decodedInt32Field = decoded.get { int32Field }
```

可以看到，定义一个消息并不是声明一个 `class` 再在其中声明一些字段，而是声明一个继承自 `PbSchema` 的 `object`（单例对象），在这个 `object` 中以 `val ... = PbXXX[n]` 的形式声明字段。在构造这一消息的对象时，可以提供一个初始化块 `{ ... }`，然后在这个块中通过 `it[...] = ...` 的方式来设置字段的值。而在访问一个对象时，可以使用 `get { ... }` 的方式来获取字段的值。

这一切看似不可思议的写法，都源自 Kotlin 用于构造 DSL（领域特定语言）的卓越能力。下面我们将深入探讨这一实现背后的原理。

## 消息构造与属性访问

为什么采用 `object` 而不是更方便的 `class`？因为这个库的初衷是兼容 Kotlin Multiplatform，而非只有 Kotlin/JVM。Kotlin 在 JVM 之外的平台（如 JavaScript 和 Native）中的反射支持十分有限，因此不能通过反射来发现消息模型中的字段；同时，笔者也并不想引入 Codegen（源代码生成）机制来增加复杂度，因此选择了这种方式来声明消息模型。

也正因如此，在实例化一条消息时，实例化的并不是我们直接声明的这个 Schema 对象（它本身只是一个单例），而是一个 `PbObject` 对象。它的定义及 API 如下所示：

```kotlin
class PbObject<S : PbSchema>(
    val schema: S,
    val tokens: MultiMap<Int, DataToken> = multiMapOf()
) {
    constructor(schema: S, byteArray: ByteArray)
    operator fun <T> get(type: PbType<T>): T
    inline fun <T> get(supplier: S.() -> PbType<T>): T
    operator fun <T> set(type: PbType<T>, value: T)
    inline fun <T> set(supplier: S.() -> Pair<PbType<T>, T>)
    fun toByteArray(): ByteArray
}

inline fun <S : PbSchema> PbObject(
    schema: S,
    block: S.(PbObject<S>) -> Unit
): PbObject<S>
```

其中 `MultiMap` 是笔者自行实现的一对多 Map 类型，`DataToken` 的定义后面再讨论。

在上面的代码中，我们实际上创建了一个 `PbObject<TestMessage>` 对象，并且对其进行了初始化。你可能会问，在上面的代码中，我们并没有显式调用 `PbObject` 的构造函数，那么这个 `PbObject<TestMessage>` 是如何被创建的呢？这就要看我们在别处定义的这个函数：

```kotlin
inline operator fun <S : PbSchema> S.invoke(
    block: S.(PbObject<S>) -> Unit
) = PbObject(this, block)
```

其中 `PbObject(this, block)` 的作用是创建一个新的 `PbObject` 实例，并将当前的 `PbSchema` 实例（即 `S`）和初始化块 `block` 传递给它。而我们定义的这个函数使用了下列 Kotlin 的魔法：

1. 它是一个扩展函数，作用于任何 `PbSchema` 的子类，包括我们所定义的 `TestMessage`；并且其包含一个泛型参数 `S`，表示具体的消息类型。这样，创建的对象就是 具体的类型 `PbObject<S>`，而非 `PbObject<PbSchema>`，这保留了 `S` 的具体类型信息。
2. 它是一个 `operator fun`，这意味着我们可以使用 `invoke` 操作符来调用它，从而以更简洁的方式创建 `PbObject` 实例。在 Kotlin 中，`invoke` 操作符就是函数调用，也就是说，在这里，`S` 本身被我们当成一个函数来调用，而提供的参数是一个初始化块。而在调用 Kotlin 函数时，如果函数的最后一个参数是一个 Lambda 表达式，我们可以将其放在括号外面；如果只有这个参数的话，甚至可以省略括号。这就是我们在上面的代码中所看到的 `TestMessage { ... }` 语法的来源。
3. 它接受的 `block` 是一个具有 implicit receiver `S` 的 Lambda 表达式。所谓 implicit receiver 即 Lambda 表达式的 `this` 直接绑定到 `S` 的实例上，我们可以用 `this.xxx` 或直接用 `xxx`（如果不和外界定义的同名字段冲突）来访问字段。因此，我们可以在初始化块中直接使用 `int32Field`、`boolField` 和 `optionalField` 等字段，而不需要显式地通过 `schema.int32Field` 的方式来访问。
4. 这个 `block` 的显式参数是一个 `PbObject<S>`，这使得我们可以在初始化块中通过这个参数来访问 `PbObject` 的属性和方法。而 Kotlin 的 Lambda 如果只有一个显式参数，我们可以直接用 `it` 来指代这个参数。
5. 这个函数是一个 `inline fun`，其中的 `block` 会在调用时被内联到调用者的上下文中，从而消除创建 Lambda 和调用的开销。

此外，`PbObject` 中的 `set` 方法同样是一个泛型的 `operator fun`：

```kotlin
operator fun <T> set(type: PbType<T>, value: T)
```

它接受两个参数：`PbType<T>` 和 `T`。因此我们可以像操作 `Map` 一样操作这个 `PbObject<S>`，通过 `it[xxx] = xxx` 来设置字段的值。

综上所述，我们在写

```kotlin
val message = TestMessage {
    it[int32Field] = 1
    it[boolField] = true
    it[optionalField] = null
}
```

时，Kotlin 编译器大概会将我们的代码翻译成这些操作：

```kotlin
val message = PbObject<TestMessage>(TestMessage)
message.set(TestMessage.int32Field, 1)
message.set(TestMessage.boolField, true)
message.set(TestMessage.optionalField, null)
```

我们再看 `get` 方法：

```kotlin
inline fun <T> get(supplier: S.() -> PbType<T>): T
```

值得注意的是它接收的也是一个 receiver 为 `S` 的 Lambda 表达式 `supplier`。因此我们可以在调用时传入一个访问 `PbSchema` 字段的 Lambda 表达式，从而获取对应字段的值：

```kotlin
val decodedInt32Field = decoded.get { int32Field }
```

我们实际上做的是：

```kotlin
val decodedInt32Field = decoded.get(TestMessage.int32Field)
```

`inline` 保证了 `supplier` 会被内联，从而消除 Lambda 的调用开销，因此我们可以随处调用 `get`。

## 字段存储与读取

看完了 `PbObject`，我们再来看看 `PbType` 的定义：

```kotlin
abstract class PbType<T>(val fieldNumber: Int) {
    abstract fun encode(value: T): MutableList<DataToken>
    abstract fun decode(tokens: List<DataToken>): T
    abstract val defaultValue: T
}
```

以及 `DataToken` 的定义：

```kotlin
internal sealed class DataToken(val wireType: Int)

internal class Varint(val value: Long): DataToken(WireType.VARINT)
internal class LengthDelimited(val dataBlock: ByteArray): DataToken(WireType.LENGTH_DELIMITED)
internal class Fixed32(val value: Int) : DataToken(WireType.FIXED32)
internal class Fixed64(val value: Long) : DataToken(WireType.FIXED64)
```

关于这些数据类型的定义在上篇中已经介绍过。总之，`PbObject` 直接储存的是 `DataToken`，而 `PbType` 则包含了将具体类型 `T` 和 `DataToken` 相互转换的逻辑。例如，我们看 `PbInt32` 的实现：

```kotlin
class PbInt32(fieldNumber: Int) : PbType<Int>(fieldNumber) {
    override fun encode(value: Int): MutableList<DataToken> {
        return mutableListOf(Varint(value.toLong()))
    }

    override fun decode(tokens: List<DataToken>): Int {
        return (tokens.firstOrNull() as? Varint)?.value?.toInt() ?: defaultValue
    }

    override val defaultValue: Int = 0

    companion object {
        operator fun get(fieldNumber: Int) = PbInt32(fieldNumber)
    }
}
```

因此，`PbObject` 的具体行为如下：

- 调用 `PbObject.set` 时，`PbObject` 会根据传入的 `PbType` 和对应的值，调用 `PbType.encode` 方法将值编码为 `DataToken`，并将其存储在内部结构中。
- 调用 `PbObject.get` 时，`PbObject` 会根据传入的 `PbType`，调用 `PbType.decode` 方法将存储的 `DataToken` 解码为具体的值。
- 调用 `PbObject.toByteArray` 时，`PbObject` 遍历自己的 `tokens` MultiMap，逐个将 `DataToken` 转换为字节数组并返回。
- 用 `ByteArray` 构造 `PbObject` 时，`PbObject` 会根据传入的字节数组，逐个解析出 `DataToken` 并存储在内部结构中。

值得注意的是，`PbInt32`（以及其他的 `PbType` 子类型）包含一个 `companion object`，其中定义了一个 `operator fun`：

```kotlin
operator fun get(fieldNumber: Int) = PbInt32(fieldNumber)
```

因此调用 `PbInt32[1]` 与 `PbInt32(1)` 是等价的。

---

笔者在编写这一框架时并没有考虑到性能问题，从上面的描述中可以看出这种实现方式的效率是相对低下的。但在该项目的应用场景下，这种开销可以接受。上述项目的主要目的并非追求极致的性能优化，而是充分展现 Kotlin 的强大表达能力。Kotlin 是一门充满“语法糖”的语言，这些语法糖使得我们能够以一种极其简洁和优雅的方式来表达复杂的逻辑。通过这种 Code-First 的设计，我们不仅避免了使用反射或代码生成的复杂性，还能让开发者以一种直观的方式来定义和操作 Protobuf 消息，从而提升了开发效率和代码可读性。
