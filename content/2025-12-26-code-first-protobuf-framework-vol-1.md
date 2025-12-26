---
title: Code-First 的 Protobuf 框架（上）
date: 2025-12-26
---

作为 TypeScript 和 Kotlin 的双料开发者，笔者先后在两种语言中编写了 Protobuf 序列化框架，并且采取了两种截然不同的设计思路，充分发挥了两种语言的特性，体现了各自的”语言之美“。本文将简要回顾 Protobuf 的基本原理，并介绍两种框架的设计思路和实现细节，供读者参考。

本文将分为上下两篇，上篇介绍的是笔者在 TypeScript 实现的一个 Protobuf 框架——[typeproto](https://github.com/SaltifyDev/typeproto)。

## Protobuf 简介

Protocol Buffers（简称 Protobuf）是由 Google 开发的一种高效的序列化协议。它通过定义消息结构的 `.proto` 文件，生成对应语言的代码，从而实现数据的序列化和反序列化。Protobuf 以其紧凑的二进制格式和跨语言支持，广泛应用于分布式系统和网络通信中。

Protobuf 的核心概念是“消息”（Message），每个消息由多个字段（Field）组成。每个字段都有一个唯一的编号（Field Number），用于标识字段在序列化数据中的位置。Protobuf 支持多种数据类型，包括基本类型（如整数、字符串）和复杂类型（如嵌套消息、枚举）。例如，以下是一个简单的 Protobuf 消息定义：

```proto
message Person {
  int32 id = 1;
  string name = 2;
  string email = 3;
}
```

Protobuf 使用变长编码（Varint）来表示整数类型，以节省存储空间。Varint 通过使用一个或多个字节来表示整数值，每个字节的最高位用于指示是否还有后续字节。这样，小整数可以用更少的字节表示，而大整数则使用更多字节。下面是 Varint 编码和解码的伪代码示例：

```plaintext
function encodeVarint(value):
    while value > 127:
        byte = (value & 0x7F) | 0x80
        writeByte(byte)
        value = value >> 7
    writeByte(value & 0x7F)
---
function decodeVarint():
    shift = 0
    result = 0
    while true:
        byte = readByte()
        result |= (byte & 0x7F) << shift
        if (byte & 0x80) == 0:
            break
        shift += 7
    return result
```

一条完整的 Protobuf 消息由多个字段组成，每个字段包含 Field Number、Wire Type 和 Field Value 三个部分。Field Number 用于标识字段，Wire Type 指示字段的编码方式，Field Value 则是字段的实际数据。Wire Type 有以下几种常见类型：

- `0`：`Varint`，用于一般的整数类型，例如 `int32`、`int64`、`uint32`、`uint64`、`bool` 和 `enum`；
- `1`：`Fixed64`，用于 64 位固定长度类型，例如 `fixed64` 和 `double`；
- `2`：`LengthDelimited`，用于长度可变的类型，例如 `string`、`bytes`、嵌套消息和重复且 `packed` 的 `Varint` 列表；
- `5`：`Fixed32`，用于 32 位固定长度类型，例如 `fixed32` 和 `float`。

`3` 和 `4` 分别称作 `Start Group` 和 `End Group`，但已被弃用。

Field Number 和 Wire Type 共同组成一个“键”（Key），用于标识字段在序列化数据中的位置。键的编码方式如下：

```plaintext
key = (Field Number << 3) | Wire Type
```

在确定了字段的键之后，接下来是字段值的编码。对于不同类型的字段，编码方式有所不同。例如，对于 Varint 类型的字段，直接使用 Varint 编码；对于 LengthDelimited 类型的字段，先用 Varint 编码字段长度，然后紧跟字段数据；对于 Fixed32 和 Fixed64 类型的字段，直接使用固定长度的字节表示。整个消息的编码就是由 `Key-Value-Key-Value-...` 这样的结构组成。

Protobuf 支持“跳过”未知字段。当解码器遇到一个未定义的字段时，可以根据其 Wire Type 来跳过该字段的数据，而不会影响后续字段的解析。这使得 Protobuf 在向后兼容性方面表现出色。而在 Protobuf 声明了但消息中未包含的字段，则会被赋予默认值，例如数值类型默认为 `0`，字符串类型默认为空字符串。

需要注意的是，和 JSON、XML 不同，Protobuf 不是自描述的，这意味着序列化后的数据并不包含字段名称或类型信息。因此，解码器必须知道消息的结构才能正确解析数据。

大多数 Protobuf 框架采用 Schema-First 的设计思路，即先定义 `.proto` 文件，然后通过代码生成器生成对应语言的代码，例如 Google 官方的 `protoc` 以及 [buf.build](https://buf.build/) 所维护的框架。这种方式的优点是结构清晰，易于维护和版本控制，但缺点是需要额外的代码生成步骤，增加了开发复杂度。而笔者所经手的项目需要快速迭代，并且是直接与后端服务进行通信，因此选择了另一种较为少见的设计思路——Code-First，即直接在代码中定义消息结构，而不依赖外部的 `.proto` 文件。这种框架的典型例子有 [Protobuf.NET](https://github.com/protobuf-net/protobuf-net)。

## 消息定义

在 typeproto 中，定义一个 Protobuf 消息的方式如下：

```typescript
const TestMessage = ProtoMessage.of({
  uint32Field: ProtoField(1, 'uint32'),
  fixed32Field: ProtoField(2, 'fixed32'),
  sint32Field: ProtoField(3, 'sint32'),
  boolField: ProtoField(4, 'bool'),
  stringField: ProtoField(5, 'string'),
  nestedMessageField: ProtoField(6, {
    nestedField: ProtoField(1, 'uint32'),
  }),
  repeatedMessageField: ProtoField(
    7,
    {
      nestedField: ProtoField(1, 'uint32'),
    },
    'repeated'
  ),
  repeatedPackedField: ProtoField(8, 'uint32', 'repeated'),
  repeatedNotPackedField: ProtoField(9, 'uint32', 'repeated', { packed: false }),
});
```

> [!note]
>
> typeproto 的设计灵感部分来源于 [`@napneko/nap-proto-core`](https://npmjs.com/package/@napneko/nap-proto-core)，其采用 `@protobuf-ts/runtime` 作为底层实现，并在此基础上封装了一层更简洁的 API。typeproto 的声明语法即起源于此，在这里对语法的最初设计者 [pk5ls20](https://github.com/pk5ls20) 表示感谢。

可以看到，`ProtoMessage.of` 方法接受一个对象，键为字段名称，值为 `ProtoField` 函数的调用。`ProtoField` 函数的第一个参数是字段编号，第二个参数是字段类型，可以是基本类型字符串（如 `'uint32'`、`'string'`）或嵌套消息的定义对象。第三个参数可选，用于指定字段的标签（如 `'repeated'`）。第四个参数也是可选的，用于传递额外的选项，例如是否启用打包（packed）。可以看到，这种声明方式与 `proto` 文件的语法除了语序外别无二致，并且深度贴合了 TypeScript 的类型系统。而序列化 / 反序列化的使用方式如下：

```typescript
const message = TestMessage.encode({
  /* ... */
});
const decoded = TestMessage.decode(buffer);
```

其中 `encode` 方法接受一个符合消息结构的对象，返回序列化后的数据；而 `decode` 方法接受一个二进制缓冲区，返回反序列化后的对象。

## 类型推导

我们注意到，`encode` 和 `decode` 方法的参数和返回值都具有明确的类型，这得益于 TypeScript 的类型推导能力。通过使用泛型和条件类型，我们可以根据消息的定义动态生成对应的 TypeScript 类型。例如，`ProtoField` 的方法签名如下：

```typescript
export function ProtoField<T extends ProtoFieldType>(fieldNumber: number, type: T): ProtoSpec<T, false, false>;
export function ProtoField<T extends ProtoFieldType>(
  fieldNumber: number,
  type: T,
  modifier: 'optional'
): ProtoSpec<T, true, false>;
export function ProtoField<T extends ProtoFieldType>(
  fieldNumber: number,
  type: T,
  modifier: 'repeated',
  options?: ProtoFieldOptions<'repeated'>
): ProtoSpec<T, false, true>;
```

为了利用类型推导，typeproto 为 `ProtoField` 定义了多个重载签名，分别对应不同的字段标签（如可选字段、重复字段）。每个重载签名返回一个 `ProtoSpec` 类型，而将字段的类型、是否可选和是否重复作为类型参数传递给 `ProtoSpec`，这样可以最大限度地保留字段的类型信息。同时，typeproto 还定义了一系列辅助类型，用于将 Protobuf 的类型映射到 TypeScript 的类型，关键类型定义如下：

```typescript
export type InferProtoModel<T extends ProtoModel | ProtoMessage<ProtoModel>> = T extends ProtoModel
  ? { [Key in keyof T]: InferProtoSpec<T[Key]> }
  : T extends ProtoMessage<infer M>
  ? InferProtoModel<M>
  : never;

export type InferProtoModelInput<T extends ProtoModel | ProtoMessage<ProtoModel>> = T extends ProtoModel
  ? Partial<{ [Key in keyof T]: InferProtoSpecInput<T[Key]> }>
  : T extends ProtoMessage<infer M>
  ? InferProtoModelInput<M>
  : never;

export type InferProtoSpec<Spec> = Spec extends ProtoSpec<infer T, infer O, infer R>
  ? R extends true
    ? O extends true
      ? never
      : Array<InferProtoSpec<ProtoSpec<T, O, false>>>
    : O extends true
    ? InferProtoSpec<ProtoSpec<T, false, false>> | undefined
    : T extends ScalarType
    ? ScalarTypeToTsType<T>
    : T extends ProtoModel | ProtoMessage<ProtoModel>
    ? InferProtoModel<T>
    : T extends Supplier<infer S extends ProtoModel | ProtoMessage<ProtoModel>>
    ? InferProtoModel<S>
    : never
  : never;

export type InferProtoSpecInput<Spec> = Spec extends ProtoSpec<infer T, infer O, infer R>
  ? R extends true
    ? O extends true
      ? never
      : Array<InferProtoSpecInput<ProtoSpec<T, O, false>>>
    : T extends ScalarType
    ? ScalarTypeToTsType<T>
    : T extends ProtoModel | ProtoMessage<ProtoModel>
    ? InferProtoModelInput<T>
    : T extends Supplier<infer S extends ProtoModel | ProtoMessage<ProtoModel>>
    ? InferProtoModelInput<S>
    : never
  : never;
```

以上类型定义实现了从消息定义到具体类型的映射，使得 `encode` 和 `decode` 方法能够自动推导出正确的参数和返回值类型，提升了开发体验和代码的类型安全性。

## 逻辑展开

一般的序列化和反序列化往往是在获得一个字段的类型之后，先确定该字段的 Wire Type，然后根据 Wire Type 选择相应的编码或解码方法。这样的逻辑通常会引入大量的运行时 `if` 和 `switch` 语句，这会大大拖慢运行效率。typeproto 的做法是：先预定义一系列编码器和解码器函数，然后在调用 `ProtoMessage.of` 时就根据提供的 `ProtoField` 信息就地组装成最终的编码器和解码器。例如，针对上面的 `TestMessage`，typeproto 会生成如下的编码器和解码器：

```typescript
const fieldSerializers = new Map<string, ProtoSerializer>();
const fieldDeserializers = new Map<number, ProtoDeserializer>();

fieldSerializers.set('uint32Field', (data, writer, cache) => {
  writer.writeVarint((1 << 3) | 0); // Field Number 1, Wire Type 0 (Varint)
  writer.writeVarint(data.uint32Field); // Field Value
});

fieldDeserializers.set(1, (draft, reader) => {
  draft.uint32Field = reader.readVarint(); // Field Value
});

// other field serializers and deserializers
```

这充分利用了 JavaScript 中“函数是一等公民”的特性，使得序列化和反序列化的逻辑在运行时几乎没有分支判断，从而提升了性能。

## 序列化：Size 计算与缓存机制

在 `fieldSerializers` 中，每个字段的序列化函数都接受三个参数：`data`、`writer` 和 `cache`。其中，`data` 是待序列化的消息对象，`writer` 是用于写入二进制数据的对象，而 `cache` 则是一个 `WeakMap`，用于缓存 `LengthDelimited` 类型字段的大小计算结果。

具体来说，在调用 `encode` 方法时，typeproto 并不会直接 `alloc` 一个足够大的缓冲区来存储序列化结果，而是先进行一次“大小计算”过程，遍历所有字段并计算出最终消息的总大小。对于 `Varint` 类型的字段，传统的计算方法是进行上文所说的位操作来确定其编码后的字节数；但如果我们知道 `Varint` 的值不会超过某个范围，就可以用下面的查表法来快速获得其大小：

```typescript
const VARINT32_BYTE_2 = 0x80;
const VARINT32_BYTE_3 = 0x4000;
const VARINT32_BYTE_4 = 0x200000;
const VARINT32_BYTE_5 = 0x10000000;

function computeVarint32Size(value: number): number {
  if (value < VARINT32_BYTE_2) return 1;
  if (value < VARINT32_BYTE_3) return 2;
  if (value < VARINT32_BYTE_4) return 3;
  if (value < VARINT32_BYTE_5) return 4;
  return 5;
}
```

而对于 `LengthDelimited` 类型的字段，计算其大小通常需要先计算字段值的大小，然后再加上表示长度的 Varint 大小。由于这种计算可能比较耗时，typeproto 通过 `cache` 参数引入了缓存机制：在第一次计算某个 `LengthDelimited` 字段的大小时，会将结果存入 `cache` 中；在后续的序列化过程中，如果再次遇到相同的字段，就可以直接从 `cache` 中获取其大小，避免重复计算。`cache` 使用 `WeakMap` 类型，这样可以确保当消息对象不再被引用时，缓存也会被自动回收。

在实际序列化时，typeproto 首先 `alloc` 一个大小刚好适合的缓冲区，然后再次遍历所有字段，调用各自的序列化函数将数据写入缓冲区。在遇到嵌套消息时，typeproto 并不会重新 `alloc`，而是直接提供缓冲区和 `offset` 给嵌套消息的序列化函数，从而避免了不必要的内存分配和复制操作，提升了整体的序列化性能。

## 反序列化：`draft` 机制

在 `fieldDeserializers` 中，每个字段的反序列化函数都接受一个 `draft` 对象和一个 `reader` 对象。其中，`draft` 对象是 typeproto 反序列化设计中的一个重要机制。它是一个中间对象，用于在反序列化过程中逐步构建最终的消息对象。

具体来说，在反序列化开始时，`draft` 会被初始化，并在解析每个字段时逐步填充。当所有字段都被解析完毕后，`draft` 会被直接返回作为最终的反序列化结果。`draft` 一开始并不是一个空对象，而是根据消息定义预先填充了默认值。例如，对于 `TestMessage`，`draft` 会进行如下初始化：

```typescript
const draft = {};
draft['uint32Field'] = 0;
draft['fixed32Field'] = 0;
draft['sint32Field'] = 0;
draft['boolField'] = false;
// ...
```

这样，当反序列化过程中遇到未定义的字段时，`draft` 中对应的字段已经有了默认值，确保了最终结果的完整性。这种设计还有一个额外的好处——享受各种 JavaScript 引擎对对象属性访问的优化，从而提升反序列化的性能。例如，V8 对于 Plain Object 有一种“隐藏类”（Hidden Class）的优化机制，当对象的属性结构固定时，属性访问会非常高效。通过预先定义 `draft` 的结构，按照相同的顺序初始化其属性，可以让 V8 生成稳定的隐藏类，从而加快属性访问速度。

---

以上是 typeproto 框架的核心设计思路和实现细节。下篇文章将介绍笔者在 Kotlin 中实现的另一个思路迥异的 Code-First Protobuf 框架，敬请期待。
