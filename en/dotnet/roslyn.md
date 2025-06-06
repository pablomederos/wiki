---
title: Roslyn: A modern compiler for C# and Visual Basic
description: A Roslyn introduction
published: true
date: 2025-06-06T14:50:06.661Z
tags: .net, c#, roslyn, visual basic, roslyn api, source generators, syntax tree, semantic model, roslyn analyzers, compiler, code analysis, code generation, static analysis, compiler as a service, metaprogramming, aot compilation
editor: markdown
dateCreated: 2025-06-06T14:50:06.661Z
---

# Roslyn: The C# and VB Compiler as a Service

If you've ever wondered what happens when you press "compile" in your .NET project, the modern answer is **Roslyn**. Far from being a simple "black box" that transforms your code into an executable, the Roslyn compiler is an open-source Compiler-as-a-Service platform for C# and Visual Basic. Its design exposes the entire compilation process, allowing developers to interact with it in interesting ways. Roslyn's main feature is its **immutability**; every change in the code generates a new syntax tree, which guarantees consistency and facilitates concurrent analysis without locking.

## Code Analysis APIs: Understanding Your Code in Depth

One of the jewels of Roslyn is its **code analysis APIs**. These give you direct access to the deep structure of your source code. Through the **Syntax Tree** API, you can traverse every node of the code—from `namespace` declarations to literals—just as it is written in the file, including whitespace and comments. For a richer analysis, the **Semantic Tree** API allows you to understand the "meaning" of the code. With it, you can resolve method overloads, determine the exact type of a variable, or find all references to a specific symbol, opening the door to the creation of powerful static analysis, refactoring, and custom linter tools directly in the development environment.

## Code Generation APIs: Building Code on the Fly

Beyond analysis, Roslyn allows you to **build, modify, and rewrite code dynamically**. The code generation APIs make it easy to create new syntax nodes, from full methods and classes to individual expressions. This capability is the engine behind **Source Generators**, one of the most powerful features of .NET. Source generators run during compilation and can inspect the user's code to produce new source code files on the fly. This allows for the automation of boilerplate code creation, performance optimization, and improved developer efficiency without the need for complex runtime reflection techniques. It also maximizes application compatibility with AOT compilation.

---

The following articles are intended to be a detailed guide on how to use the different tools offered by the compiler, whether you use Visual Studio, Rider, Visual Studio Code, or just the CLI to develop your applications.