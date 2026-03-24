---
title: Lauren 编程笔记（一）
date: 2026-03-21
---

[Lauren](https://github.com/Wesley-Young) 是一个稳定子体系量子电路模拟平台，作为笔者在[徐勇](https://iiis.tsinghua.edu.cn/rydw/qzjs/xuyong.htm)课题组的一个项目，是为了解决 [ExtendedStim](https://github.com/Moke2001/ExtendedStim) 的 Python 运算逻辑在 CPython 解释器下速度过慢的问题，同时也是笔者为了增进自己对 Clifford 仿真的理解。在本文写作之时，Lauren 的 `Physics` 模块已接近完工。本文将介绍 Clifford 模拟的基本知识，并简要介绍 Lauren 目前已经完成的部分的构造和运行原理。

## Clifford 模拟简介

### 量子态的稳定子表示

对于一般的含有 $n$ 个量子比特的量子电路，其纯态可以表示为

$$
|\psi\rangle = \sum_{x \in \{0,1\}^n} \alpha_x |x\rangle
$$

即一个 $2^n$ 维的复向量。

而在 Clifford 模拟里，我们不需要记录这个态的完整波函数，而是记录一组**稳定子**（Stabilizer）。

所谓稳定子，就是作用于一个量子态上的算符（一组量子 Gate 的组合），如果这个算符作用在这个量子态上后，得到的结果仍然是这个量子态，那么我们就说这个量子态被这个算符**稳定**了。一个稳定子通常可以写作一个 Pauli String，例如对于一个 3 个量子比特的系统：

$$
S=X_1I_2Z_3
$$

表示一个作用在第一个量子比特上的 $X$ 门，一个作用在第二个量子比特上的 $I$ 门（即不动），一个作用在第三个量子比特上的 $Z$ 门。如果一个量子态被这个稳定子所稳定，那么我们就有：

$$
S|\psi\rangle = |\psi\rangle
$$

可以证明，对于 $n$ 个量子比特的系统，如果一个量子态被 $n$ 个独立的稳定子所稳定，那么这个量子态就是一个纯态。因此我们有机会用 $n$ 个稳定子来完全描述一个 $n$ 个量子比特的纯态，而不需要记录整个 $2^n$ 维的波函数。简单地说：

- 一般的量子态记录的空间复杂度为 $O(2^n)$；
- Clifford 模拟记录的空间复杂度为 $O(n^2)$。

### Clifford 门和 Pauli 测量

有了节省空间的量子态表示方式，我们还需要知道什么样的量子门和测量可以在这个表示方式下高效地更新稳定子，而不至于把量子态破坏到无法用稳定子表示的程度。这样的量子门被称为 Clifford 门，常见的 Clifford 门包括：

- $X$ 门：将 $|0\rangle$ 和 $|1\rangle$ 互换，而保持 $|+\rangle$ 和 $|-\rangle$ 不变（但会反转相位）；
- $Z$ 门：将 $|+\rangle$ 和 $|-\rangle$ 互换，而保持 $|0\rangle$ 和 $|1\rangle$ 不变（但会反转相位）；
- $Y$ 门：相当于先施加 $X$ 门再施加 $Z$ 门，并且引入一个相位变化 $i$；
- $H$ 门：将 $|0\rangle$ 和 $|+\rangle$ 互换，将 $|1\rangle$ 和 $|-\rangle$ 互换；
- $S$ 门：将 $X$ 门映射成 $Y$ 门，这是由于共轭作用 $SXS^\dagger = Y$；
- `CNOT` 门（Controlled-NOT，也被称为 `CX`）：将控制比特为 $|1\rangle$ 的目标比特翻转。

而 Pauli 测量则是对这组量子比特进行 $X$、$Y$ 或 $Z$ 方向的测量，并最终得到一个经典的测量结果（0 或 1）。在 Clifford 模拟中，我们可以通过更新稳定子来模拟 Clifford 门和 Pauli 测量的作用，而不需要记录整个波函数。在 Clifford 模拟中，对量子态施加一个 Clifford 门，并不需要直接更新波函数，而是更新这组稳定子。

对于任意一个量子态 $|\psi\rangle$，我们施加一个外部门 $U$，得到新的量子态 $U|\psi\rangle$。我们定义新的稳定子

$$
S' = USU^\dagger
$$

下面我们验证 $S'$ 能有效稳定新的量子态 $U|\psi\rangle$：

$$
S' U|\psi\rangle = USU^\dagger U|\psi\rangle = U S |\psi\rangle = U|\psi\rangle
$$

因此，量子比特门的实现问题，归根结底就是：**它会如何共轭作用于一个 Pauli String**。如果我们能设计出有效表示 Pauli String 的数据结构，并且能够高效地计算 Clifford 门对 Pauli String 的共轭作用，那么我们就可以通过更新稳定子来模拟 Clifford 门的作用了。

### 优势与局限

Gottesman–Knill 定理断言：

> 任何仅由 Clifford 门与 Pauli 测量组成的量子电路，都可以在**经典计算机**上高效模拟。

这就是 Clifford 模拟能在计算机上运行的理论基础。

Clifford 模拟的最大优势在于它能够在经典计算机上高效地模拟一类重要的量子电路，特别是那些在量子错误纠正和量子通信中经常出现的电路。然而，Clifford 模拟也有其局限性。例如，加入一个 $T$ 门（非 Clifford 门）就会使得模拟的复杂度从多项式级别跃升到指数级别，这时候“量子优势”就开始出现了。

## Lauren 的基本构成

Lauren 的 Stage 1 主要包含以下几个部分：

- `Lauren.Physics`：实现 Clifford 模拟所需的基础设施，主要是：
  - 量子算符 `QuantumOperator`，Pauli String 的 C# 表示；
  - 量子平台 `Platform`，用于记录一组 $n$ 个量子比特的稳定子，并提供通过任意的 `QuantumOperator` 来更新稳定子的能力；
  - 量子平台的简化版本 `Frame`，只记录错误信息，而不实际进行比特操作，用于快速取样一段电路的错误分布并建立错误模型（Detector Error Model, DEM）。
- `Lauren.Circuit`：实现量子电路的表示和解析。
- `Lauren.Codes`：提供量子纠错码基类，以及一些常见的量子纠错码的实现。

整个项目的 Stage 1 目标是通过给定的量子码的矩阵表示（Parity Check Matrix）和物理错误率（Physical Error Rate）来建立带噪声的量子线路，并通过 Clifford 模拟来取样这段电路的错误分布，最终建立一个 DEM，以 Stim 格式输出，进而对接整个 Stim 生态。

目前只有 `Lauren.Physics` 模块已经接近完工（另外两个模块一笔未动），下面将跟随源代码简要介绍 `Lauren.Physics` 的构造和运行原理。`Lauren.Physics` 除支持 Pauli-base 的模拟外，还支持部分 Majorana-base 的模拟，本文将仅就 Pauli-base 的模拟进行介绍。

## `QuantumOperator`

`QuantumOperator` 是 Pauli String 的 C# 表示，记录哪些位被 X 或 Z 占据，同时包含一个系数（Coefficient）。它的构造函数是这样的：

```csharp
protected QuantumOperator(BitArray occupiedX,
                          BitArray occupiedZ,
                          Coefficient coefficient = Coefficient.PlusI)
```

其中 `occupiedX` 和 `occupiedZ` 分别是一个 `BitArray`，记录哪些位被 X 或 Z 占据。对于一个 $n$ 个量子比特的系统，我们可以用两个长度为 $n$ 的 `BitArray` 来表示一个 Pauli String。例如，如果我们有一个 3 个量子比特的系统，并且我们想表示 $X_1I_2Z_3$，我们可以设置：

- `occupiedX` 的第 0 位为 1（表示第一个量子比特被 X 占据），第 1 位为 0（表示第二个量子比特不被 X 占据），第 2 位为 0（表示第三个量子比特不被 X 占据）；
- `occupiedZ` 的第 0 位为 0（表示第一个量子比特不被 Z 占据），第 1 位为 0（表示第二个量子比特不被 Z 占据），第 2 位为 1（表示第三个量子比特被 Z 占据）。

当然，还有一个 `Coefficient`，表示这个 Pauli String 的系数，可以是 $+1$、$-1$、$+i$ 或 $-i$。`QuantumOperator` 类还提供了一些方法，例如检测是否为 Hermitian 算符，求对偶算符，计算两个 `QuantumOperator` 的乘积等。其中乘积的计算方法是将两个 `QuantumOperator` 的 `occupiedX` 和 `occupiedZ` 分别进行异或操作（在物理上对应将不同位置上的 Pauli 矩阵相乘），并根据 Pauli 乘法规则计算新的系数。

## `Coefficient`

`Coefficient` 是一个枚举类型，表示一个 Pauli String 的系数：

```csharp
public enum Coefficient
{
    PlusOne,
    MinusOne,
    PlusI,
    MinusI
}
```

C# 中的枚举类型的内部表示是一个整数，因此上述四个值分别对应 0、1、2、3。`Coefficient` 类还提供了一些方法，例如计算两个 `Coefficient` 的乘积和次幂。由于 `Coefficient` 是乘法封闭的，因此可以通过查表法来计算它们的乘积：

```csharp
private static readonly Coefficient[] MultiplyTable =
[
    Coefficient.PlusOne, Coefficient.MinusOne, Coefficient.PlusI, Coefficient.MinusI,
    Coefficient.MinusOne, Coefficient.PlusOne, Coefficient.MinusI, Coefficient.PlusI,
    Coefficient.PlusI, Coefficient.MinusI, Coefficient.MinusOne, Coefficient.PlusOne,
    Coefficient.MinusI, Coefficient.PlusI, Coefficient.PlusOne, Coefficient.MinusOne
];
```

这个数组的含义是，如果我们想计算 $a \cdot b$，其中 $a$ 和 $b$ 都是 `Coefficient`，我们可以通过以下方式来计算：

```csharp
public static Coefficient Multiply(Coefficient a, Coefficient b) =>
    MultiplyTable[((int)a << 2) | (int)b];
```

计算机对位移和按位或操作的效率非常高，因此这种查表法可以在常数时间内计算两个 `Coefficient` 的乘积。计算一个 `Coefficient` 的次幂也可以通过类似的查表法来计算，这里就不再赘述了。

## `Platform`

`Platform` 是 Clifford 模拟的主战场，它记录了一组 $n$ 个量子比特的稳定子，并提供通过任意的 `QuantumOperator` 来更新稳定子的能力。`Platform` 通过一个名叫 `PlatformStateFrame` 的类来记录稳定子信息：

```csharp
internal sealed class PlatformStateFrame
{
    public int TotalRows => Coefficients.Length;

    public Coefficient[] Coefficients { get; }

    public BitArray[] QubitRows { get; }

    public BitArray[] FermiRows { get; }
}
```

它记录了一个 $n$ 个量子比特的系统的稳定子信息，其中 `Coefficients` 记录了每个稳定子的系数，`QubitRows` 记录了每个稳定子对应的 Pauli String 的 X 和 Z 占据情况，`FermiRows` 则是为了支持 Majorana-base 的模拟而设计的。而 `Platform` 类的构造函数则是这样初始化自己的 `PlatformStateFrame`：

```csharp
public Platform(int pauliCount, int majoranaCount)
{
    if (pauliCount < 0) throw new ArgumentOutOfRangeException(nameof(pauliCount));
    if (majoranaCount < 0) throw new ArgumentOutOfRangeException(nameof(majoranaCount));

    PauliCount = pauliCount;
    MajoranaCount = majoranaCount;

    _state = new PlatformStateFrame(
        pauliCount + majoranaCount,
        2 * pauliCount,
        2 * majoranaCount);

    for (int i = 0; i < pauliCount; i++)
    {
        _state.Coefficients[i] = Coefficient.PlusOne;
        _state.QubitRows[i][(2 * i) + 1] = true;
    }

    for (int i = 0; i < majoranaCount; i++)
    {
        int row = pauliCount + i;
        _state.Coefficients[row] = Coefficient.PlusI;
        _state.FermiRows[row][2 * i] = true;
        _state.FermiRows[row][(2 * i) + 1] = true;
    }
}
```

它在初始化时创建了一个 `PlatformStateFrame`，其中 `Coefficients` 的长度为 $n$（即稳定子的数量），`QubitRows` 的长度为 $n$，每个 `QubitRow` 的长度为 $2n$，使用的是 $X_1, Z_1, X_2, Z_2, \ldots, X_n, Z_n$ 的顺序来记录每个稳定子对应的 Pauli String 的占据情况。对于 Majorana-base 的模拟不再赘述。

在初始化时，我们将前 $n$ 个稳定子的系数设置为 $+1$，并且将每个稳定子对应的 Pauli String 设置为 $Z_i$（即第 $i$ 个量子比特被 Z 占据）。例如，对于一个 3 个量子比特的系统，我们的初始稳定子就是：

$$
\begin{aligned}
S_1 &= +Z_1I_2I_3 \\
S_2 &= +I_1Z_2I_3 \\
S_3 &= +I_1I_2Z_3
\end{aligned}
$$

这是一个典型的初始稳定子集合，表示系统处于 $+|000\rangle$ 态，因为 $Z$ 门作用在 $|0\rangle$ 态上会得到 $+1$ 的本征值。

下面以单量子比特门 $X$、$H$ 和双量子比特门 `CNOT` 为例，简要介绍一下 `Platform` 是如何通过更新稳定子来模拟 Clifford 门的作用的。

### $X$ 门

$X$ 门的共轭作用可以表示如下：

$$
XX_iX^\dagger = X_i, \quad XZ_iX^\dagger = -Z_i
$$

因此 $X$ 不会改变稳定子的占据，但如果当前稳定子被 $Z_i$ 占据，那么施加 $X$ 门后这个稳定子的系数会翻转（从 $+1$ 变为 $-1$，或者从 $-1$ 变为 $+1$）。因此我们只需要检查每个稳定子是否被 $Z_i$ 占据，如果是的话就翻转它的系数即可。下面是 `Platform` 中的实现：

```csharp
public void X(int qubitIndex)
{
    PlatformArgumentUtility.ValidatePauliQubitIndex(qubitIndex, PauliCount);

    int zColumn = CliffordTransformUtility.GetPauliZColumn(qubitIndex);
    for (int i = 0; i < _state.TotalRows; i++)
    {
        if (_state.QubitRows[i][zColumn])
        {
            _state.Coefficients[i] *= Coefficient.MinusOne;
        }
    }
}
```

### $H$ 门

$H$ 门的共轭作用可以表示如下：

$$
HX_iH^\dagger = Z_i, \quad HZ_iH^\dagger = X_i, \quad HY_iH^\dagger = -Y_i
$$

因此 $H$ 会交换稳定子中 $X_i$ 和 $Z_i$ 的占据情况；如果一个稳定子同时被 $X_i$ 和 $Z_i$ 占据，那么施加 $H$ 门后这个稳定子的系数会翻转（从 $+1$ 变为 $-1$，或者从 $-1$ 变为 $+1$）。因此我们需要检查每个稳定子是否被 $X_i$ 和 $Z_i$ 占据，并且根据占据情况来更新稳定子的占据和系数。下面是 `Platform` 中的实现：

```csharp
public void H(int qubitIndex)
{
    PlatformArgumentUtility.ValidatePauliQubitIndex(qubitIndex, PauliCount);
    for (int i = 0; i < _state.TotalRows; i++)
    {
        _state.Coefficients[i] *= CliffordTransformUtility.ApplyH(_state.QubitRows[i], qubitIndex);
    }
}

public static Coefficient ApplyH(BitArray qubits, int qubitIndex)
{
    int xColumn = GetPauliXColumn(qubitIndex);
    int zColumn = GetPauliZColumn(qubitIndex);
    bool xOccupied = qubits[xColumn];
    bool zOccupied = qubits[zColumn];
    qubits[xColumn] = zOccupied;
    qubits[zColumn] = xOccupied;
    return xOccupied && zOccupied ? Coefficient.MinusOne : Coefficient.PlusOne;
}
```

### `CNOT` 门

`CNOT` 门是双量子比特门，它的共轭作用比较复杂，因为它会同时影响控制比特和目标比特的占据情况。设 `CNOT` 的控制比特为 $c$，目标比特为 $t$，它的共轭作用可以表示如下：

$$
X_cI_t \rightarrow X_cX_t \\
Z_cI_t \rightarrow Z_cI_t \\
I_cX_t \rightarrow I_cX_t \\
I_cZ_t \rightarrow Z_cZ_t
$$

因此在 `CNOT` 门中：

- 控制位 $c$ 上的 $X$ 占据会导致目标位 $t$ 上的 $X$ 占据被翻转；
- 目标位 $t$ 上的 $Z$ 占据会导致控制位 $c$ 上的 $Z$ 占据被翻转。

`CNOT` 门是量子纠缠的主要来源，它的共轭作用会导致稳定子之间的相互影响，从单体稳定子转换为多体稳定子。下面是 `Platform` 中的实现：

```csharp
public void CX(int controlIndex, int targetIndex)
{
    PlatformArgumentUtility.ValidatePauliQubitIndex(controlIndex, PauliCount, nameof(controlIndex));
    PlatformArgumentUtility.ValidatePauliQubitIndex(targetIndex, PauliCount, nameof(targetIndex));

    for (int i = 0; i < _state.TotalRows; i++)
    {
        CliffordTransformUtility.ApplyCX(_state.QubitRows[i], controlIndex, targetIndex);
    }
}

public static Coefficient ApplyCX(BitArray qubits, int controlIndex, int targetIndex)
{
    int controlXColumn = GetPauliXColumn(controlIndex);
    int controlZColumn = GetPauliZColumn(controlIndex);
    int targetXColumn = GetPauliXColumn(targetIndex);
    int targetZColumn = GetPauliZColumn(targetIndex);

    bool controlX = qubits[controlXColumn];
    bool targetZ = qubits[targetZColumn];
    qubits[targetXColumn] ^= controlX;
    qubits[controlZColumn] ^= targetZ;
    return Coefficient.PlusOne;
}
```

### 测量

在完成一系列 Clifford 门的模拟后，我们还可以提供任意一个 `QuantumOperator` 来测量当前的量子态。它的流程如下：

---

首先，检测这个 `QuantumOperator` 是否为 Hermitian 算符，因为只有 Hermitian 算符才属于可测量的物理量。

---

然后，寻找与这个 `QuantumOperator` 反对易的稳定子。如果存在多个反对易的稳定子，我们可以通过乘法来将它们合并成一个反对易的稳定子。

其数学原理如下：假设 $S_1$ 和 $S_2$ 都与测量算符 $M$ 反对易，即

$$
S_1M = -MS_1, \quad S_2M = -MS_2
$$

那么它们的乘积就立刻与 $M$ 交换了：

$$
(S_1S_2)M = S_1(S_2M) = S_1(-MS_2) = -(-MS_1)S_2 = M(S_1S_2)
$$

因此只要寻找到一个反对易的稳定子，那么我们可以继续寻找剩余的反对易稳定子，并将它们乘到这个稳定子上，这样就可以得到一个与测量算符 $M$ 反对易的稳定子了。

---

如果存在反对易的稳定子，我们通过抛硬币来决定测量结果是 $+1$ 还是 $-1$，并且根据测量结果把这个反对易稳定子直接**覆盖**成 $\pm M$。

这是因为反对易的稳定子注定无法稳定同一个态，而测量算符 $M$ 会让整个系统的量子态坍缩成 $M$ 的一个本征态，而非 $M$ 的本征态的部分会被抛弃掉，因此我们覆盖这个反对易稳定子，就相当于把系统的量子态坍缩成 $M$ 的一个本征态了。

---

如果不存在反对易的稳定子，那么测量结果就是确定的，也就是说只可能有 $M|\psi\rangle = +|\psi\rangle$ 或 $M|\psi\rangle = -|\psi\rangle$，我们可以通过求解线性方程组来判断是哪一种情况。具体来说，我们要尝试把 $M$ 分解成一些稳定子 $S_i$ 的乘积（注意这时我们不考虑稳定子的符号，而只考虑稳定子的结构），也就是说我们要尝试找到一些 $x_i \in \{0,1\}$ 使得：

$$
M=\prod_{i} S_i^{x_i}
$$

由于在 GF(2) 空间中，乘积对应于异或操作，因此我们可以把每个稳定子 $S_i$ 的占据情况看作一个二进制向量，而 $M$ 的占据情况也看作一个二进制向量，那么上面的方程就转化成了一个线性方程组：

$$
M=\bigoplus_{i} x_i S_i
$$

这是一个典型的线性代数问题，我们可以通过高斯消元法来求解这个方程组。如果这个方程组有解，那么测量结果就是确定的；如果没有解（实际上这种情况不太可能，如果出现的话，一定是算法实现有 bug），我们就抛出一个异常。

在找到一个这样的分解之后，我们就可以通过判断这几个稳定子实际相乘之后的系数是 $+1$ 还是 $-1$ 来判断测量结果是 $+1$ 还是 $-1$。此外，由于 $M$ 本身也可能携带系数，所以我们还需要把 $M$ 的系数考虑进去，最终得到测量结果。

---

下面是 `Platform` 中的实现：

```csharp
/// <summary>
///     Measure a Hermitian operator on the platform.
/// </summary>
/// <param name="op">
///     The operator to measure, which must be Hermitian and supported by the platform's site counts.
/// </param>
/// <returns>+1 or -1, the outcome of the measurement.</returns>
/// <exception cref="ArgumentException">
///     Thrown if the operator is not Hermitian or does not match the platform's qubit and
///     fermi site counts.
/// </exception>
/// <exception cref="InvalidOperationException">
///     Thrown if the operator is not in the span of the current stabilizers after
///     accounting for anti-commutation.
/// </exception>
public int Measure(QuantumOperator op)
{
    if (!op.IsHermitian())
    {
        throw new ArgumentException("Measurement operator must be Hermitian.");
    }

    var measurement = OperatorEmbeddingUtility.Embed(op, PauliCount, MajoranaCount);

    int firstAnticommutingIndex = -1;
    for (int i = 0; i < _state.TotalRows; i++)
    {
        if (_state.Commutes(i, measurement.Qubits, measurement.FermiSites))
        {
            continue;
        }

        if (firstAnticommutingIndex == -1)
        {
            firstAnticommutingIndex = i;
            continue;
        }

        _state.MultiplyRowInPlace(i, firstAnticommutingIndex);
    }

    // Yield a random outcome if there is an anti-commuting stabilizer, and collapse the state accordingly.
    if (firstAnticommutingIndex != -1)
    {
        bool isPlusOutcome = Random.Shared.NextDouble() < 0.5;
        var coefficient = isPlusOutcome
            ? measurement.Coefficient
            : measurement.Coefficient * Coefficient.MinusOne;
        _state.OverwriteRow(
            firstAnticommutingIndex,
            measurement.Qubits,
            measurement.FermiSites,
            coefficient);
        return isPlusOutcome ? 1 : -1;
    }

    // If all stabilizers commute with the measurement, the outcome is deterministic, and we can solve for it.
    if (!_state.TrySolveSpan(measurement.Qubits, measurement.FermiSites, out bool[] solution))
    {
        throw new InvalidOperationException("Measured operator is not in the span of current stabilizers.");
    }

    var evaluatedCoefficient = _state.MultiplySelectedCoefficient(solution);
    return evaluatedCoefficient == measurement.Coefficient ? 1 : -1;
}
```

## 未来开发与性能优化

目前 `Lauren.Physics` 模块已经接近完工，后续将开发 `Circuit` 和 `Codes` 模块，完成 Stage 1。从性能上看，目前 `Physics` 模块虽然有 C# JIT 的加持，但其代码逻辑中仍然存在 `for` 循环等，并且使用 `BitArray` 来表示占据情况也不甚高效，未来将会通过 SIMD 指令、`ulong` 位运算等尽量让运算矢量化，以期达到更高的性能。
