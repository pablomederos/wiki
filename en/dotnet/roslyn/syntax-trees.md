---
title: Syntax Trees in C# with Roslyn
description: Guide to creating and structuring source code from syntax trees
published: true
date: 2025-06-12T12:25:45.713Z
tags: .net, c#, roslyn, syntax tree, code generation, metaprogramming, syntaxfactory, syntaxnode, syntaxtoken, syntaxtrivia, compilationunitsyntax, classdeclarationsyntax, methoddeclarationsyntax, localdeclarationstatementsyntax, invocationexpressionsyntax, namespacedeclarationsyntax, roslyn compiler, api code analysis, code refactoring
editor: markdown
dateCreated: 2025-06-06T20:29:35.549Z
---

# Creating and Manipulating Syntax Trees in C# with Roslyn SyntaxFactory

I. [Introduction to Roslyn Syntax Trees and SyntaxFactory](#introduction)
  - A. [Fundamental Principles of Roslyn Syntax Trees](#principles)
  - B. [Components of a Syntax Tree: Nodes, Tokens, and Trivia](#components)
  - C. [The Central Role of Microsoft.CodeAnalysis.CSharp.SyntaxFactory](#syntaxfactory-role)
    - 1. [`SyntaxFactory` Methods for Common C# Constructs](#syntaxfactory-methods)
    - 2. [Mapping of C# Elements to Roslyn Syntax Types](#mapping-types)

II. [Building Fundamental C# Code Elements](#building-elements)
  - A. [Creating Classes (ClassDeclarationSyntax)](#creating-classes)
  - B. [Defining Methods (MethodDeclarationSyntax)](#defining-methods)
  - C. [Crafting Code Blocks (BlockSyntax) for Method Bodies](#crafting-blocks)

III. [Generating Content Inside Method Blocks](#generating-content)
  - A. [Declaring and Assigning Local Variables (`LocalDeclarationStatementSyntax`)](#declaring-variables)
  - B. [Invoking Other Methods (InvocationExpressionSyntax)](#invoking-methods)
  - C. [Return Statements (ReturnStatementSyntax)](#return-statements)

IV. [Assembling a Complete Compilation Unit (CompilationUnitSyntax)](#assembling-compilation-unit)
  - A. [Incorporating `using` Directives (UsingDirectiveSyntax)](#using-directives)
  - B. [Declaring Namespaces (NamespaceDeclarationSyntax)](#declaring-namespaces)
  - C. [Nesting Classes, Methods, and Declarations to Form a Complete .cs File](#nesting-complete-file)
  
V. [Generating the Final Source Code](#generating-source-code)
  - A. [Converting the SyntaxTree to a Text String (`ToFullString()`)](#tofullstring)
  - B. [Importance of `NormalizeWhitespace()` for Readability](#normalize-whitespace)

VI. [Compiling the Syntax Tree (Brief Optional Mention)](#compiling)
VII. [Conclusion and Advanced Considerations](#conclusion)

This technical document provides a comprehensive guide on programmatically creating C# syntax trees using the Roslyn compiler API, with a central focus on the `Microsoft.CodeAnalysis.CSharp.SyntaxFactory` class. It will detail the processes for constructing fundamental C\# language elements, such as classes, methods, and code blocks, including specific examples of variable assignment, method invocation, and return statements.

<div id="introduction"/>

## I. Introduction to Roslyn Syntax Trees and SyntaxFactory

Syntax trees are the fundamental data structure exposed by the Roslyn compiler APIs, representing the lexical and syntactic structure of source code. These trees are crucial for a variety of tasks, including compilation, code analysis, refactoring, and code generation.

<div id="principles"/>

### A. Fundamental Principles of Roslyn Syntax Trees

Two key attributes define the nature of syntax trees in Roslyn: immutability and full fidelity.

  - **Immutability:** A central design feature in Roslyn is that syntax trees are immutable. Once a tree is obtained, it represents a snapshot of the code's state at that moment and never changes. Any operation that appears to "modify" a tree actually produces a new instance of the tree with the changes applied. This immutability is the foundation of thread safety and predictability within the Roslyn ecosystem. Since compilers and code analysis tools, such as integrated development environments (IDEs), often need to process source code in multithreaded environments to improve responsiveness and performance, mutable data structures would require complex locking mechanisms. By making syntax trees immutable, Roslyn eliminates the need for these locks when reading tree data, allowing multiple threads to analyze the same tree safely and concurrently. This considerably simplifies the development of tools built on Roslyn, such as analyzers and IDE features. The apparent disadvantage of not being able to modify a tree directly is mitigated by efficient factory methods and the reuse of underlying nodes, which allows for the rapid reconstruction of new versions with little additional memory. Therefore, it is crucial to adopt a transformational mindset: instead of "changing a node," you are "creating a new node based on an old one with modifications."
  - **Full Fidelity:** Syntax trees in Roslyn maintain full fidelity with the source language. This means that every piece of information found in the source code text, including every grammatical construct, every lexical token, whitespace, comments, and preprocessor directives, is contained in the tree. As a result, it is possible to obtain the exact textual representation of the subtree from any syntax node, which allows syntax trees to be used for constructing and editing source text. If the trees did not have full fidelity, it would be impossible to reconstruct the exact original source text, which is problematic for tools that need to make minimal changes while preserving user formatting and comments. When generating code from scratch using SyntaxFactory, the default factory methods may not insert the "trivia" (spaces, line breaks) that a human would insert for readability. Therefore, the generated code might appear "compressed" or incorrectly indented if trivia is not managed, which connects to the need for `SyntaxNode.NormalizeWhitespace()` or the manual addition of trivia to produce readable code.

<div id="components"/>

### B. Components of a Syntax Tree: Nodes, Tokens, and Trivia

Each syntax tree is hierarchically composed of three main elements: `nodes`, `tokens`, and `trivia`.

  - **Nodes (SyntaxNode):** Syntax nodes represent syntactic constructs such as declarations (classes, methods), statements (loops, conditionals), clauses, and expressions. Each category of syntax nodes is represented by a separate class derived from `Microsoft.CodeAnalysis.SyntaxNode`. Syntax nodes are non-terminal elements in the tree, meaning they always have other nodes and tokens as children.
  - **Tokens (SyntaxToken):** Syntax tokens represent the smallest pieces of code with grammatical meaning, such as individual keywords (`public`, `class`), identifiers (names of variables or methods), literals (numbers, strings), operators (`+`, `=`), or punctuation marks (`{`, `(`, `;`). They are the terminal nodes of the syntax tree.
  - **Trivia (SyntaxTrivia):** Syntax trivia represents parts of the source text that are mostly insignificant for the compiler's semantic understanding but are crucial for human readability and full fidelity. This includes whitespace, line breaks, comments, and preprocessor directives.

These three components are hierarchically composed to form a tree that completely represents everything in a C\# code snippet. The C\# language has a formal grammar, and the Roslyn parser breaks down the source code text according to this grammar. `SyntaxNode`s represent the top-level productions, `SyntaxToken`s the indivisible lexical symbols, and `SyntaxTrivia` captures everything else. This systematic decomposition allows for detailed access to every part of the code. To use `SyntaxFactory` effectively, it is necessary to think in terms of these components.

<div id="syntaxfactory-role"/>

### C. The Central Role of Microsoft.CodeAnalysis.CSharp.SyntaxFactory

The `Microsoft.CodeAnalysis.CSharp.SyntaxFactory` class is fundamental to code generation with Roslyn. It provides a comprehensive set of static factory methods for programmatically constructing every type of syntax node, token, and trivia that can appear in a C\# code file. For every language element, from a keyword to a full class declaration, there is a corresponding method in `SyntaxFactory` to create an instance of that element.
The methods in `SyntaxFactory` often feature multiple overloads that accept different levels of detail. For example, a class declaration can be created simply with its name, or with a full set of attributes, modifiers, base list, etc. This offers flexibility, allowing for simple or very detailed constructions. Furthermore, the nodes returned by `SyntaxFactory` often have `With...` methods (e.g., `classDeclaration.WithModifiers(...)`) that allow for gradual node construction or the creation of a new, modified version of an existing node, in line with the principle of immutability. The RoslynQuoter tool, available at [this link](https://roslynquoter.azurewebsites.net/), is a valuable resource for discovering which `SyntaxFactory` methods and `With...` methods are used to construct an existing C\# code snippet.

Below are tables that serve as a quick reference for mapping common C\# constructs to the corresponding `SyntaxFactory` methods and Roslyn types.

<div id="syntaxfactory-methods"/>

#### `SyntaxFactory` Methods for Common C\# Constructs

|C\# Construct|Primary SyntaxFactory Method(s)|
|-|-|
|Class Declaration|SyntaxFactory.ClassDeclaration(...)|
|Method Declaration|SyntaxFactory.MethodDeclaration(...)|
|Local Variable Declaration|SyntaxFactory.LocalDeclarationStatement(...)|
|Method Invocation|SyntaxFactory.InvocationExpression(...)|
|Return Statement|SyntaxFactory.ReturnStatement(...)|
|Namespace Declaration|SyntaxFactory.NamespaceDeclaration(...)|
|Using Directive|SyntaxFactory.UsingDirective(...)|
|Identifier Name|SyntaxFactory.IdentifierName(...)|
|Literal Expression|SyntaxFactory.LiteralExpression(...)|
|Code Block|SyntaxFactory.Block(...)|

<div id="mapping-types"/>

#### Mapping of C# Elements to Roslyn Syntax Types

|C# Element|Corresponding SyntaxKind|Corresponding SyntaxNode or `SyntaxToken` Type|
|-|-|-|
|public|SyntaxKind.PublicKeyword|SyntaxToken|
|class MyClass {... }|SyntaxKind.ClassDeclaration|ClassDeclarationSyntax|
|void MyMethod() {... }|SyntaxKind.MethodDeclaration|MethodDeclarationSyntax|
|int x = 10;|SyntaxKind.LocalDeclarationStatement|LocalDeclarationStatementSyntax|
|Console.WriteLine();|SyntaxKind.InvocationExpression (wrapped in ExpressionStatement)|InvocationExpressionSyntax (wrapped in ExpressionStatementSyntax)|
|return;|SyntaxKind.ReturnStatement|ReturnStatementSyntax|
|namespace MyNamespace {... }|SyntaxKind.NamespaceDeclaration|NamespaceDeclarationSyntax|
|using System;|SyntaxKind.UsingDirective|UsingDirectiveSyntax|

These tables provide a starting point for understanding how familiar C\# constructs translate into the world of Roslyn types and factories.

<div id="building-elements"/>

## II. Building Fundamental C\# Code Elements

C# code generation involves assembling various types of declarations and structures. `SyntaxFactory` provides the building blocks for each of these.

<div id="creating-classes"/>

### A. Creating Classes (ClassDeclarationSyntax)

A class declaration is a fundamental component in C\#. To generate one, the `SyntaxFactory.ClassDeclaration()` method is used. This method has several overloads; the simplest might take only the class name, while more complete ones allow specifying attributes, modifiers, base types, generic type constraints, and members.
To create a basic class like `public class MyClass { }`, these steps are followed:

  - **Class Identifier:** Create a `SyntaxToken` for the class name using `SyntaxFactory.Identifier("MyClass")`.
  - **Modifiers:** Create a `SyntaxToken` for the `public` keyword using `SyntaxFactory.Token(SyntaxKind.PublicKeyword)`. This token is wrapped in a `SyntaxTokenList` using `SyntaxFactory.TokenList(publicModifier)`.
  - **Members:** For an empty class, an empty list of members is created: `SyntaxFactory.List<MemberDeclarationSyntax>()`.
  - **Class Declaration:** `SyntaxFactory.ClassDeclaration()` is invoked with the identifier token. Then, the `WithModifiers()` and `WithMembers()` methods are used on the resulting `ClassDeclarationSyntax` object to attach the list of modifiers and the list of members, respectively.

Creating a class, therefore, involves assembling multiple pieces: the class token (implicit in `ClassDeclaration`), the name identifier, the modifier tokens, the braces (which `SyntaxFactory` handles when building the node), and a list of members. `SyntaxFactory` provides the means to create each of these pieces, offering granular control over the generated structure. This detailed construction process is similar to assembling a model from individual components.

<div id="defining-methods"/>

### B. Defining Methods (MethodDeclarationSyntax)

Methods encapsulate executable logic within classes. `SyntaxFactory.MethodDeclaration()` is the starting point for their creation. This method requires specifying the return type, the method name, and optionally, access modifiers, a list of parameters, and a method body.
To generate a method like `public void MyMethod(int param1, string param2) { }`:

  - **Modifiers:** Similar to classes, a `SyntaxTokenList` is created for modifiers like `public` (e.g., `SyntaxFactory.TokenList(SyntaxFactory.Token(SyntaxKind.PublicKeyword))`).
  - **Return Type:** For predefined types like `void` or `int`, `SyntaxFactory.PredefinedType()` is used with the appropriate keyword token (e.g., `SyntaxFactory.Token(SyntaxKind.VoidKeyword)`). For other types, `SyntaxFactory.ParseTypeName("TypeName")` can be used.
  - **Method Name:** An identifier `SyntaxToken` is created with `SyntaxFactory.Identifier("MyMethod")`.
  - **Parameter List (ParameterListSyntax):** This is a more complex component.
    For each parameter, a `ParameterSyntax` is created using `SyntaxFactory.Parameter()` with an identifier for the parameter name (e.g., `SyntaxFactory.Identifier("param1")`) and is assigned a type using the `WithType()` method (e.g., `.WithType(SyntaxFactory.PredefinedType(SyntaxFactory.Token(SyntaxKind.IntKeyword)))`).
    The individual `ParameterSyntax` nodes are assembled into a `SeparatedSyntaxList<ParameterSyntax>`. This list handles the commas between parameters. For example: `SyntaxFactory.SeparatedList<ParameterSyntax>(new SyntaxNodeOrToken{param1Syntax, SyntaxFactory.Token(SyntaxKind.CommaToken), param2Syntax})`.
    Finally, this separated list is wrapped in a `ParameterListSyntax` using `SyntaxFactory.ParameterList(separatedParameters)`.
  - **Method Body:** For a method with an empty body, a `BlockSyntax` is created using `SyntaxFactory.Block()`.
  - **Method Declaration:** `SyntaxFactory.MethodDeclaration()` is invoked with all these components.

The creation of a `MethodDeclarationSyntax` faithfully reflects the grammatical structure of a method declaration in C\#. The management of parameters underscores how immutability guides the API design: you don't "add" a parameter to an existing list; instead, you create a new parameter list and, consequently, a new method declaration node with this new list.

<div id="crafting-blocks"/>

### C. Crafting Code Blocks (BlockSyntax) for Method Bodies

A `BlockSyntax` represents a code block delimited by braces (`{...}`), such as a method body or an `if` statement. It is created using `SyntaxFactory.Block()`. This method can accept a `SyntaxList<StatementSyntax>` (a list of statements) or an array of `StatementSyntax` as an argument, or it can be called without arguments to create an empty block.
A `BlockSyntax` is fundamentally a container for a sequence of statements. Its main property is `Statements`, which is a `SyntaxList<StatementSyntax>`. If you have an existing `BlockSyntax` (e.g., from `MethodDeclarationSyntax.Body`), you can "add" statements using the `AddStatements()` method. Due to immutability, this method returns a new `BlockSyntax` with the added statements. This new block would then replace the old one in the parent node (e.g., `methodDeclaration.WithBody(newBlock)`).

For the purpose of this note, an empty `BlockSyntax` will be created initially, which will then be populated with statements: `BlockSyntax methodBody = SyntaxFactory.Block();`
This block will be ready for the statements that define the method's behavior to be added.

<div id="generating-content"/>

## III. Generating Content Inside Method Blocks

Once you have a `BlockSyntax` (usually as a method body), you can populate it with various statements that define the program's logic.

<div id="declaring-variables"/>

### A. Declaring and Assigning Local Variables (`LocalDeclarationStatementSyntax`)

Declaring local variables is a common operation. To generate a statement like `int count = 10;`, a `LocalDeclarationStatementSyntax` is constructed. This process is hierarchical and involves creating several nested nodes:

  - **Literal Value Expression:** For the value `10`, a numeric `LiteralExpressionSyntax` is created:
    `SyntaxFactory.LiteralExpression(SyntaxKind.NumericLiteralExpression, SyntaxFactory.Literal(10))`
    The `SyntaxFactory.Literal()` function has overloads for various data types, including integers, strings, booleans, etc.
  - **Initializer Clause (EqualsValueClauseSyntax):** This represents the `= 10` part: `SyntaxFactory.EqualsValueClause(literalExpression)` (**Note**: `SyntaxFactory.EqualsValueClause` takes the expression directly; the `=` token is implicit or added via an overload that takes a `SyntaxToken` equalsToken). A more explicit form is: `SyntaxFactory.EqualsValueClause(SyntaxFactory.Token(SyntaxKind.EqualsToken), literalExpression)`
  - **Variable Declarator (VariableDeclaratorSyntax):** Defines the variable's name and its initializer: `SyntaxFactory.VariableDeclarator(SyntaxFactory.Identifier("count")).WithInitializer(initializerClause)`
  - **Variable Declaration (VariableDeclarationSyntax):** Specifies the variable's type and contains one or more declarators. Such as `SyntaxFactory.PredefinedType(SyntaxFactory.Token(SyntaxKind.IntKeyword))` for `int`.
  - **Declarators:** `SyntaxFactory.SingletonSeparatedList(variableDeclarator)` is used for a single declarator. For more than one declarator, one could use `SyntaxFactory.VariableDeclaration(typeSyntax).AddVariables(variableDeclarator)`.
  - **Local Declaration Statement (LocalDeclarationStatementSyntax):** This is the complete statement, including the final semicolon: `SyntaxFactory.LocalDeclarationStatement(variableDeclaration).WithSemicolonToken(SyntaxFactory.Token(SyntaxKind.SemicolonToken))`
    To declare `string message = "Hello";`, the process is analogous, using `SyntaxKind.StringKeyword` for the type and `SyntaxFactory.LiteralExpression(SyntaxKind.StringLiteralExpression, SyntaxFactory.Literal("Hello"))` for the value.

The declaration of a local variable is an excellent example of hierarchical construction in Roslyn. It is built from the inside out or in parts, assembling smaller nodes into larger structures. The Syntax Visualizer or tools like RoslynQuoter are invaluable for deconstructing existing examples and understanding this hierarchy.

<br>
<br>

<div id="invoking-methods"/>

### B. Invoking Other Methods (InvocationExpressionSyntax)

Method calls are represented by `InvocationExpressionSyntax`. This applies to both instance methods (`object.Method()`) and static methods (`Class.Method()`).

  - **Member Access Expression (MemberAccessExpressionSyntax):**
    For an instance call like `myObject.Process(count)`, the `myObject.Process` part is a `MemberAccessExpressionSyntax`. It is created with: `SyntaxFactory.MemberAccessExpression(SyntaxKind.SimpleMemberAccessExpression, SyntaxFactory.IdentifierName("myObject"), SyntaxFactory.IdentifierName("Process"))`.
    For a static call like `System.Console.WriteLine(message)`, the `System.Console.WriteLine` part is also a `MemberAccessExpressionSyntax`. `System.Console` itself can be a `QualifiedNameSyntax`: `SyntaxFactory.MemberAccessExpression(SyntaxKind.SimpleMemberAccessExpression, SyntaxFactory.QualifiedName(SyntaxFactory.IdentifierName("System"), SyntaxFactory.IdentifierName("Console")), SyntaxFactory.IdentifierName("WriteLine"))`.
  - **Argument List (ArgumentListSyntax):**
    Each argument is wrapped in an `ArgumentSyntax`. For example, for the `count` argument: `SyntaxFactory.Argument(SyntaxFactory.IdentifierName("count"))`.
    If the argument is a literal, like `"Hello"`: `SyntaxFactory.Argument(SyntaxFactory.LiteralExpression(SyntaxKind.StringLiteralExpression, SyntaxFactory.Literal("Hello")))`.
    The `ArgumentSyntax` nodes are grouped into a `SeparatedSyntaxList<ArgumentSyntax>` (to handle commas if there are multiple arguments). For a single argument: `SyntaxFactory.SingletonSeparatedList(argumentSyntax)`.
    This separated list is passed to `SyntaxFactory.ArgumentList()`: `SyntaxFactory.ArgumentList(separatedArgumentList)`.
  - **Invocation Expression (InvocationExpressionSyntax):** Combines the member access expression and the argument list: `SyntaxFactory.InvocationExpression(memberAccessExpression, argumentListSyntax)`.
    An `InvocationExpressionSyntax` is an expression. For it to constitute a complete statement in a method block (e.g., a call to a void method or when its return value is not used), it must be wrapped in an `ExpressionStatementSyntax` and terminated with a semicolon: `SyntaxFactory.ExpressionStatement(invocationExpression).WithSemicolonToken(SyntaxFactory.Token(SyntaxKind.SemicolonToken))`.

<div id="return-statements"/>

### C. Return Statements (ReturnStatementSyntax)

`return` statements are generated using `SyntaxFactory.ReturnStatement()`. This method has overloads to handle returns with a value and returns from void methods.

  - **Returning a value:** For `return result;`, where `result` is a variable: `SyntaxFactory.ReturnStatement(SyntaxFactory.IdentifierName("result")).WithSemicolonToken(SyntaxFactory.Token(SyntaxKind.SemicolonToken))`.
    To return a literal, like `return 0;`: `SyntaxFactory.ReturnStatement(SyntaxFactory.LiteralExpression(SyntaxKind.NumericLiteralExpression, SyntaxFactory.Literal(0))).WithSemicolonToken(SyntaxFactory.Token(SyntaxKind.SemicolonToken))`.
  - **Return for void method:** For `return;`: `SyntaxFactory.ReturnStatement().WithSemicolonToken(SyntaxFactory.Token(SyntaxKind.SemicolonToken))`. The `SyntaxFactory.ReturnStatement()` overload without arguments creates the basis for a `return;`. It is crucial to add the `SemicolonToken` if the used overload does not include it implicitly.
    The `ReturnStatementSyntax` has an `Expression` property that can be `null` for `void` returns. The `SyntaxFactory` overloads reflect this, allowing the expression to be omitted or passed explicitly.

<div id="assembling-compilation-unit"/>

## IV. Assembling a Complete Compilation Unit (CompilationUnitSyntax)

A `CompilationUnitSyntax` is the root node of any syntax tree that represents a complete C\# code file. It contains elements such as `using` directives, namespace declarations, and type declarations (`class`, `struct`, etc.).

<div id="using-directives"/>

### A. Incorporating `using` Directives (UsingDirectiveSyntax)

`using` directives are created with `SyntaxFactory.UsingDirective()`, which takes a `NameSyntax` representing the namespace to import. For `using System;`: `NameSyntax systemName = SyntaxFactory.ParseName("System"); UsingDirectiveSyntax usingSystem = SyntaxFactory.UsingDirective(systemName).WithSemicolonToken(SyntaxFactory.Token(SyntaxKind.SemicolonToken));`
The `SyntaxFactory.ParseName()` method is particularly useful here, as it can parse a string like "System.Collections.Generic" and construct the appropriate nested `QualifiedNameSyntax` structure. These `using` directives are then added to the `CompilationUnitSyntax` using its `AddUsings()` method.

<div id="declaring-namespaces"/>

### B. Declaring Namespaces (NamespaceDeclarationSyntax)

Namespaces organize code and are created with `SyntaxFactory.NamespaceDeclaration()`, which also takes a `NameSyntax` for the namespace name. For `namespace MyGeneratedCode {...}`: `NameSyntax namespaceIdentifier = SyntaxFactory.ParseName("MyGeneratedCode"); NamespaceDeclarationSyntax namespaceDeclaration = SyntaxFactory.NamespaceDeclaration(namespaceIdentifier);`
Like a class, a `NamespaceDeclarationSyntax` acts as a container for its members (classes, structs, other namespaces, etc.), which are added using the `AddMembers()` method.

<div id="nesting-complete-file"/>

### C. Nesting Classes, Methods, and Declarations to Form a Complete .cs File

The process of creating a complete `.cs` file involves building the syntax tree hierarchically, starting from the innermost elements (like literals and identifiers) and progressively assembling them up to the root `CompilationUnitSyntax`.
The following comprehensive example demonstrates the creation of a C\# file with the following structure:

```csharp
using System;

namespace MyGeneratedCode
{
    public class MyClass
    {
        public void MyMethod()
        {
            int x = 10;
            System.Console.WriteLine(x);
            return;
        }
    }
}
````

<div id="step-by-step" \>

#### Step-by-step construction:

**`using` Directive:**

```csharp
UsingDirectiveSyntax usingSystem = SyntaxFactory
    .UsingDirective(SyntaxFactory.ParseName("System"))
    .WithSemicolonToken(SyntaxFactory.Token(SyntaxKind.SemicolonToken));
```

**Statements for the body of the `MyMethod` method:**

`int x = 10;`

```csharp
LocalDeclarationStatementSyntax localVarDecl = SyntaxFactory
    .LocalDeclarationStatement(
        SyntaxFactory.VariableDeclaration(
            SyntaxFactory.PredefinedType(
                SyntaxFactory.Token(SyntaxKind.IntKeyword)
            ),
            SyntaxFactory.SingletonSeparatedList(
                SyntaxFactory.VariableDeclarator(SyntaxFactory.Identifier("x"))
                    .WithInitializer(SyntaxFactory.EqualsValueClause(
                        SyntaxFactory.LiteralExpression(
                            SyntaxKind.NumericLiteralExpression,
                            SyntaxFactory.Literal(10)
                        )
                    ))
            ))
    ).WithSemicolonToken(SyntaxFactory.Token(SyntaxKind.SemicolonToken));
```

`System.Console.WriteLine(x);`

```csharp
ExpressionStatementSyntax methodCall = SyntaxFactory
    .ExpressionStatement(
        SyntaxFactory.InvocationExpression(
            SyntaxFactory.MemberAccessExpression(
                SyntaxKind.SimpleMemberAccessExpression,
                SyntaxFactory.QualifiedName(
                    SyntaxFactory.IdentifierName("System"),
                    SyntaxFactory.IdentifierName("Console")
                ),
                SyntaxFactory.IdentifierName("WriteLine")
            ),
            SyntaxFactory.ArgumentList(
                SyntaxFactory.SingletonSeparatedList(
                    SyntaxFactory.Argument(SyntaxFactory.IdentifierName("x"))
                )
            )
        )
    ).WithSemicolonToken(SyntaxFactory.Token(SyntaxKind.SemicolonToken));
```

`return;`

```csharp
ReturnStatementSyntax returnStatement = SyntaxFactory.ReturnStatement()
    .WithSemicolonToken(SyntaxFactory.Token(SyntaxKind.SemicolonToken));
```

**Body of the `MyMethod` Method:**

```csharp
BlockSyntax methodBody = SyntaxFactory
    .Block(localVarDecl, methodCall, returnStatement);
```

**Declaration of the `MyMethod` Method:**

```csharp
MethodDeclarationSyntax methodDeclaration = SyntaxFactory
    .MethodDeclaration(
        SyntaxFactory.PredefinedType(
            SyntaxFactory.Token(SyntaxKind.VoidKeyword)
        ),
        SyntaxFactory.Identifier("MyMethod")
    )
    .AddModifiers(SyntaxFactory.Token(SyntaxKind.PublicKeyword))
    .WithBody(methodBody);
```

**Declaration of the `MyClass` Class:**

```csharp
ClassDeclarationSyntax classDeclaration = SyntaxFactory
    .ClassDeclaration("MyClass")
    .AddModifiers(SyntaxFactory.Token(SyntaxKind.PublicKeyword))
    .AddMembers(methodDeclaration);
```

**Declaration of the `MyGeneratedCode` Namespace:**

```csharp
NamespaceDeclarationSyntax namespaceDeclaration = SyntaxFactory
    .NamespaceDeclaration(SyntaxFactory.ParseName("MyGeneratedCode"))
    .AddMembers(classDeclaration);
```

**Compilation Unit (CompilationUnitSyntax):**

```csharp
CompilationUnitSyntax compilationUnit = SyntaxFactory.CompilationUnit()
    .AddUsings(usingSystem)
    .AddMembers(namespaceDeclaration);
```

This nesting process illustrates the "tree" metaphor: you start with the "leaves" (tokens, identifiers) and assemble them into "branches" (expressions, statements) until you form the "trunk" (`CompilationUnitSyntax`). This hierarchical structure is the essence of how Roslyn represents code.

<div id="generating-source-code"\>

## V. Generating the Final Source Code

Once the `CompilationUnitSyntax` has been built, the next step is to convert this syntax tree into a text string that represents the C\# source code.

<div id="tofullstring"\>

### A. Converting the SyntaxTree to a Text String (`ToFullString()`)

Any `SyntaxNode`, including the root `CompilationUnitSyntax` node of a tree, can be converted to its text string representation using the `ToFullString()` method. This method is fundamental for obtaining the output of the generated code. For example: `string generatedCode = compilationUnit.ToFullString();`.
The `ToFullString()` method respects the "full fidelity" principle, which means it includes all trivia (whitespace, line breaks, comments) present in the syntax tree. If the tree was generated programmatically using `SyntaxFactory` without explicitly adding trivia nodes for formatting, the result of `ToFullString()` will be syntactically correct, but it might not be well-formatted for human reading, appearing as one long line of code or with minimal spacing.

<div id="normalize-whitespace"\>

### B. Importance of `NormalizeWhitespace()` for Readability

To address the formatting issue, Roslyn provides the `SyntaxNode.NormalizeWhitespace()` method. This method reconstructs the tree (or a subtree from a given node) with normalized whitespace trivia, applying standard C\# indentation and spacing. The typical usage is: `string formattedCode = compilationUnit.NormalizeWhitespace().ToFullString();`
`NormalizeWhitespace()` is a convenient way to get standard, readable formatting. However, it is important to consider that `NormalizeWhitespace()` creates a new tree, which can have performance implications in high-frequency scenarios or with very large trees, such as in source generators. For most code generation cases where standard readability is the main goal, the combination of `NormalizeWhitespace().ToFullString()` is the recommended approach. If very specific format control is required, it would be necessary to manipulate the trivia manually.

<div id="compiling"\>

## VI. Compiling the Syntax Tree (Brief Optional Mention)

Although the main focus of this guide is the creation of syntax trees, it is relevant to mention that these trees are the direct input to the Roslyn compiler. A generated `SyntaxTree` can be compiled into an assembly, either in memory or on disk.
This process typically involves creating a `CSharpCompilation` object using `CSharpCompilation.Create()`. This method takes the assembly name, a collection of `SyntaxTree`s to compile, a list of `MetadataReference`s (references to other assemblies like **mscorlib**), and `CSharpCompilationOptions`. Once you have the `CSharpCompilation` object, you can invoke the `Emit()` method to produce the assembly. The result of `Emit()` (an `EmitResult`) will indicate whether the compilation was successful and will provide diagnostics in case of errors.
It is crucial to understand that `SyntaxFactory` deals with the syntactic correctness of the code. Compilation, on the other hand, verifies semantic correctness. This means that, although a tree generated with `SyntaxFactory` is structurally valid according to C\# grammar, it could contain semantic errors (e.g., using an undefined type or calling a non-existent method) that will only be detected during compilation.

<div id="conclusion"\>

## VII. Conclusion and Advanced Considerations

Roslyn's `SyntaxFactory` API offers a powerful and detailed mechanism for the programmatic generation of C\# code. Through the hierarchical construction of nodes, tokens, and trivia, it is possible to create precise representations of any C\# language construct, from simple expressions to complete compilation units. The principles of immutability and full fidelity are fundamental to Roslyn's design, ensuring safety in multithreaded environments and the ability to reproduce source code accurately.
Tools like **RoslynQuoter** and the **Visual Studio Syntax Visualizer** are invaluable resources that can greatly facilitate learning and debugging when working with `SyntaxFactory`, as they allow you to inspect the structure of syntax trees and see how different nodes are constructed.
While this note has covered the fundamental aspects of creating classes, methods, and common statements, there are more advanced areas for further exploration:

  - **Detailed Manipulation of SyntaxTrivia:** For absolute control over the format of the generated code, including comments and specific preprocessor directives.
  - **Using the Semantic API (SemanticModel):** To generate code that depends on the semantic context, such as existing types in the project or symbol information. The `SemanticModel` allows for making more intelligent and context-aware code generation decisions.
  - **Syntax Rewriting Techniques with CSharpSyntaxRewriter:** For more complex code transformations that involve visiting and modifying nodes in an existing syntax tree, `CSharpSyntaxRewriter` is a powerful tool.

The ability to generate syntax trees programmatically is a cornerstone of the extensibility of the .NET platform and the C\# language. It enables a wide range of metaprogramming scenarios, from automating repetitive coding tasks and enforcing coding conventions, to creating domain-specific languages (DSLs) embedded in C\# and building more sophisticated development tools. Mastery of `SyntaxFactory` and the underlying concepts of Roslyn syntax trees is, therefore, a valuable skill for developers looking to interact with C\# code at a deeper level.

Some other sources to delve deeper into the topic:

1.  Roslyn on GitHub · dotnet/docs - GitHub, [https://github.com/dotnet/docs/blob/main/docs/csharp/roslyn-sdk/work-with-syntax.md](https://github.com/dotnet/docs/blob/main/docs/csharp/roslyn-sdk/work-with-syntax.md)
2.  Get started with syntax analysis (Roslyn APIs) - C\# | Microsoft Learn, [https://learn.microsoft.com/en-us/dotnet/csharp/roslyn-sdk/get-started/syntax-analysis](https://learn.microsoft.com/en-us/dotnet/csharp/roslyn-sdk/get-started/syntax-analysis) 
3.  `SyntaxFactory` Class (Microsoft.CodeAnalysis.CSharp), [https://learn.microsoft.com/en-us/dotnet/api/microsoft.codeanalysis.csharp.syntaxfactory?view=roslyn-dotnet-4.13.0](https://learn.microsoft.com/en-us/dotnet/api/microsoft.codeanalysis.csharp.syntaxfactory?view=roslyn-dotnet-4.13.0)
4.  Get started with syntax transformation (Roslyn APIs) - C\# | Microsoft Learn, [https://learn.microsoft.com/en-us/dotnet/csharp/roslyn-sdk/get-started/syntax-transformation](https://learn.microsoft.com/en-us/dotnet/csharp/roslyn-sdk/get-started/syntax-transformation) 
5.  Getting Started C\# Syntax Transformation - GitHub, [https://github.com/dotnet/roslyn/blob/main/docs/wiki/Getting-Started-C%23-Syntax-Transformation.md](https://github.com/dotnet/roslyn/blob/main/docs/wiki/Getting-Started-C%23-Syntax-Transformation.md) 
6.  SyntaxFactory.ClassDeclaration Method (Microsoft.CodeAnalysis ..., [https://learn.microsoft.com/en-us/dotnet/api/microsoft.codeanalysis.csharp.syntaxfactory.classdeclaration?view=roslyn-dotnet-4.13.0](https://learn.microsoft.com/en-us/dotnet/api/microsoft.codeanalysis.csharp.syntaxfactory.classdeclaration?view=roslyn-dotnet-4.13.0) 
7.  SyntaxFactory.MethodDeclaration Method (Microsoft.CodeAnalysis.CSharp), [https://learn.microsoft.com/en-us/dotnet/api/microsoft.codeanalysis.csharp.syntaxfactory.methoddeclaration?view=roslyn-dotnet-4.7.0](https://learn.microsoft.com/en-us/dotnet/api/microsoft.codeanalysis.csharp.syntaxfactory.methoddeclaration?view=roslyn-dotnet-4.7.0) 
8.  SyntaxFactory.MethodDeclaration Method (Microsoft.CodeAnalysis ..., [https://learn.microsoft.com/en-us/dotnet/api/microsoft.codeanalysis.csharp.syntaxfactory.methoddeclaration](https://learn.microsoft.com/en-us/dotnet/api/microsoft.codeanalysis.csharp.syntaxfactory.methoddeclaration)
9.  SyntaxFactory.Block Method (Microsoft.CodeAnalysis.CSharp), [https://learn.microsoft.com/en-us/dotnet/api/microsoft.codeanalysis.csharp.syntaxfactory.block?view=roslyn-dotnet-4.13.0](https://learn.microsoft.com/en-us/dotnet/api/microsoft.codeanalysis.csharp.syntaxfactory.block?view=roslyn-dotnet-4.13.0) 
10\. Roslyn - Creating an introduce and initialize field refactoring - trydis, [https://trydis.github.io/2015/01/03/roslyn-code-refactoring/](https://trydis.github.io/2015/01/03/roslyn-code-refactoring/) 
11\. SyntaxFactory.Literal Method (Microsoft.CodeAnalysis.CSharp), [https://learn.microsoft.com/en-us/dotnet/api/microsoft.codeanalysis.csharp.syntaxfactory.literal?view=roslyn-dotnet-4.9.0](https://learn.microsoft.com/en-us/dotnet/api/microsoft.codeanalysis.csharp.syntaxfactory.literal?view=roslyn-dotnet-4.9.0) 
12\. SyntaxFactory.InvocationExpression Method (Microsoft ..., [https://learn.microsoft.com/en-us/dotnet/api/microsoft.codeanalysis.csharp.syntaxfactory.invocationexpression?view=roslyn-dotnet-4.13.0](https://learn.microsoft.com/en-us/dotnet/api/microsoft.codeanalysis.csharp.syntaxfactory.invocationexpression?view=roslyn-dotnet-4.13.0) 
13\. Creating Code Using the Syntax Factory - John Koerner, [https://johnkoerner.com/csharp/creating-code-using-the-syntax-factory/](https://johnkoerner.com/csharp/creating-code-using-the-syntax-factory/) 
14\. SyntaxFactory.ReturnStatement Method (Microsoft.CodeAnalysis ..., [https://learn.microsoft.com/en-us/dotnet/api/microsoft.codeanalysis.csharp.syntaxfactory.returnstatement?view=roslyn-dotnet-4.9.0](https://learn.microsoft.com/en-us/dotnet/api/microsoft.codeanalysis.csharp.syntaxfactory.returnstatement?view=roslyn-dotnet-4.9.0) 
15\. SyntaxFactory.CompilationUnit Method (Microsoft.CodeAnalysis.CSharp), [https://learn.microsoft.com/en-us/dotnet/api/microsoft.codeanalysis.csharp.syntaxfactory.compilationunit?view=roslyn-dotnet-4.13.0](https://learn.microsoft.com/en-us/dotnet/api/microsoft.codeanalysis.csharp.syntaxfactory.compilationunit?view=roslyn-dotnet-4.13.0) 
16\. SyntaxFactory.UsingDirective Method (Microsoft.CodeAnalysis.CSharp), [https://learn.microsoft.com/en-us/dotnet/api/microsoft.codeanalysis.csharp.syntaxfactory.usingdirective?view=roslyn-dotnet-4.13.0](https://learn.microsoft.com/en-us/dotnet/api/microsoft.codeanalysis.csharp.syntaxfactory.usingdirective?view=roslyn-dotnet-4.13.0) 
17\. .NET Core, Roslyn and Code Generation · Code it Yourself - Carlos Mendible, [https://carlos.mendible.com/2017/01/29/net-core-roslyn-and-code-generation/](https://carlos.mendible.com/2017/01/29/net-core-roslyn-and-code-generation/)
18\. Compiling C\# Code with Roslyn ..., [https://josephwoodward.co.uk/2016/12/in-memory-c-sharp-compilation-using-roslyn](https://josephwoodward.co.uk/2016/12/in-memory-c-sharp-compilation-using-roslyn)