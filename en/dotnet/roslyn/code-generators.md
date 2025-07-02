---
title: Metaprograming with Code Generators
description: A comprehensive guide to code generation using the Roslyn compiler APIs
published: false
date: 2025-07-02T20:09:26.924Z
tags: 
editor: markdown
dateCreated: 2025-07-02T20:05:08.179Z
---

# Code Generators with Roslyn

I. [Incremental Generation: Foundation and Application](#incremental-generation-foundation-and-application)
  - A. [Fundamental advantages of compile-time code generation](#fundamental-advantages)
  - B. [Use cases in the .NET ecosystem](#use-cases)
  - C. [Portability considerations](#portability-considerations)
  - D. [Evolution from `ISourceGenerator` to `IIncrementalGenerator`](#isourcegenerator-evolution)
  - E. [Elements of a Code Generator](#generator-elements)
  - F. [Strategies for Identifying Generation Targets](#identification-strategies)
  
II. [Practical Implementation](#practical-implementation)
III. [Testing the code generator](#testing-generator)
IV. [The performance offered by the cache](#cache-performance)
  - A. [The Cache Engine: Memoization in the Pipeline](#cache-engine)
  - B. [`ISymbol`: Its Effect on Performance](#isymbol-performance)
  - C. [Best Practice: The Equatable DTO Pattern](#equatable-dto-pattern)
  - D. [Optimizing the Pipeline Structure](#optimizing-pipeline)
  - E. [Table: Cache Best Practices for Incremental Generators](#table-best-practices)
  
V. [Conclusion and Final Recommendations](#conclusion-recommendations)

Metaprogramming is the way a program treats other programs (or itself) as data, as we will see in the following paragraphs. This has opened the doors to the development of frameworks over the years and has given them flexibility and dynamism that would have otherwise been considerably difficult. Luckily, .NET provides us with several solutions to manipulate and extend our applications, such as reflection ([runtime reflection](https://learn.microsoft.com/es-es/dotnet/fundamentals/reflection/reflection)), and T4 templates ([T4 templates](https://learn.microsoft.com/en-us/visualstudio/modeling/code-generation-and-t4-text-templates?view=vs-2022)). But, both techniques (especially reflection) present performance problems during application startup and execution, since in the case of reflection, the framework must analyze the code during runtime, resulting in an extra fixed time cost that is not possible to optimize (or at least not at the level of compiled code). T4 templates are a bit more flexible in this regard, but everything will depend on the use case.

Thanks to the arrival of the [`Roslyn`](https://github.com/dotnet/roslyn) compiler, we went from working in a "black box" to doing it on an open platform with APIs for analyzing and generating code. This is where **Source Generators** come from. Basically a component that analyzes the code at compile time (practically every time text is added or removed from the source code) to produce new source files that are compiled with the rest of the code.

The idea of this article is to explain what an incremental code generator is, how it improves application performance, and the relationship between the programmer and their code. Although it is no longer something new, I want to present the now standard for compile-time metaprogramming in C#, for the development of modern and high-performance libraries.

-----

<div id="incremental-generation-foundation-and-application"\>

## I. Incremental Generation: Foundation and Application

<br>

<div id="fundamental-advantages"\>

### A. Fundamental advantages of compile-time code generation

<br>

1.  **Performance Improvement**
As I mentioned before, instead of performing an analysis during runtime, it is done at compile time, improving application startup, and the general response throughout the execution of a process. This is a substantial improvement over what could be done until now.
An example of an implementation that offers the benefits I mentioned is the [`GeneratedRegexAttribute`](https://learn.microsoft.com/en-us/dotnet/api/system.text.regularexpressions.generatedregexattribute?view=net-7.0) attribute, introduced in **.NET 7**. It is used to avoid compiling a regular expression at runtime, generating optimized code during compilation that evaluates matches. This is clearly a major performance improvement. Another example could be the [`LibraryImport`](https://learn.microsoft.com/en-us/dotnet/standard/native-interop/pinvoke-source-generation) attribute (one of the C# tools I like the most is [PInvoke](https://www.pinvoke.net/)), which comes to be a substitute for `DllImport`, as well as the advanced techniques currently used by Blazor (another marvel in .NET) to convert razor templates into generated classes, which specialize in the generation of HTML documents.
      
2.  **Elimination of repetitive code (Boilerplate)**
Another benefit is saving us from writing repetitive and error-prone code, such as creating DTOs, mappers, or even DAOs and functions for accessing databases or network resources.
      
3.  **Modern deployment models**
Possibly one of the most important advantages (at least for me), is compatibility with modern optimization technologies such as **AOT** ([Ahead-of-Time](https://learn.microsoft.com/en-us/dotnet/core/deploying/native-aot/?tabs=windows%2Cnet8)) compilation, and **Trimming** ([Assembly trimming](https://learn.microsoft.com/en-us/dotnet/core/deploying/trimming/trim-self-contained)). These technologies are extremely positive in cloud environments, mobile, or use cases that require high efficiency. In these cases, compatibility with reflection is nonexistent or very poor, performance is possibly paramount, and right there code generation allows obtaining all the necessary code during compilation. This turns from a simple optimization into a pillar of architectural design in the **.NET** strategy for the future.
      

<div id="use-cases"\>

### B. Use cases in the .NET ecosystem

When dealing with code generators, it is not something isolated or for a select few, but they are currently intimately integrated into the **.NET** platform.

1.  **`System.Text.Json` Serializer**
The **JSON** serializer integrated into .NET is an impeccable example of a use case. Using the [`JsonSerializableAttribute`](https://learn.microsoft.com/es-es/dotnet/api/system.text.json.serialization.jsonserializableattribute?view=net-8.0) attribute on a partial class that extends from `JsonSerializerContext`, it is possible to activate a code generator that analyzes our classes and generates optimal serialization and deserialization logic during compilation. This results in a performance improvement of up to 40% thanks to avoiding the use of reflection. [I refer to these tests](https://okyrylchuk.dev/blog/intro-to-serialization-with-source-generation-in-system-text-json/).

**The generator uses two modes of operation:**
  - **Metadata-based mode**: It pre-collects the necessary metadata from types to speed up serialization and deserialization.
  - **Serialization optimization mode**: It generates the code using `Utf8JsonWriter` directly, for the highest serialization performance, but it is more restrictive and does not support all customization options.

> More details at [Microsoft Learn: serialization/system text json/source generation](https://learn.microsoft.com/en-us/dotnet/standard/serialization/system-text-json/source-generation)
>   

1.  **ASP.NET Core and Native AOT**
    Another interesting case can be that of ASP.NET Core which uses the built-in `RequestDelegateGenerator` generator. This makes Minimal APIs compatible with **Native AOT**. For this, `interceptors` are used, which will be discussed in detail in another article (when I gather enough experience, as it is still preliminary and I have not delved enough into the subject). But basically, it intercepts calls to `app.MapGet()` that would normally depend on reflection, replacing them with precompiled logic. This, in addition to maximizing performance, also increases the portability of the code.
      

> More details at: [Use the Request Delegate Generator (RDG) to create request delegates for Map methods in ASP.NET Core](https://learn.microsoft.com/es-es/aspnet/core/fundamentals/aot/request-delegate-generator/rdg?view=aspnetcore-8.0)
>   

3.  **Dependency Injection**
    Many high-performance Dependency Injection containers ([Pure.DI](https://github.com/DevTeam/Pure.DI), [Injectio](https://github.com/loresoft/Injectio), [Jab](https://github.com/pakrym/jab), [StrongInject](https://github.com/YairHalberstadt/stronginject) [*some more active than others*]) implement the use of code generators, generating the dependency graph during compilation, detecting in this same phase which dependencies have not yet been implemented or are incomplete. This reduces the probability of receiving exceptions at runtime, not to mention the improvement in performance.
      

<div id="portability-considerations"\>

### C. Portability considerations

When developing a code generator, you have to take into account the environment in which it will be executed.

1.  **Target Framework**
It is important that the generator project targets `netstandard2.0` to maximize compatibility with different versions of **Visual Studio**, **MSBuild**, the **.NET SDK**, and even some other IDEs.
      
2.  **IDE vs. Command Line Compilation**
The incremental pipeline, as well as the cache system (which will be discussed later in this article), benefit greatly from the IDE (**Visual Studio**, **Rider**, etc.), offering immediate feedback to the developer and improving the development experience. If the command line is used, this compilation process will not be automatic and will probably require adding a script to improve the experience (it will really be needed). Editors like **Visual Studio Code** and derivatives might have integrated support through the official **.NET** and **C#** extensions ([C# Dev Kit](https://marketplace.visualstudio.com/items?itemName=ms-dotnettools.csdevkit) or others), but without these extensions, you have to keep in mind that the code will not be generated frequently, or at the slightest change, but only until a compilation occurs.
      
3.  **Cross-platform environments**
Development in **Unity** or other platforms may surely require some additional configuration for the generators to be recognized as a compilation component. Each one will surely have it documented for each specific case, so I am not going to delve into the subject, but I mention it so as not to leave it as something arbitrary.
      

<div id="isourcegenerator-evolution"\>

### D. Evolution from `ISourceGenerator` to `IIncrementalGenerator`

In short, using the `ISourceGenerator` interface is not an option at all. `IIncrementalGenerator` is the only option, because the previous one was marked as obsolete. But, I must mention it because there is still a lot of documentation, and it is common to find outdated courses or somewhat old YouTube videos that focus on the use of `ISourceGenerator`.

1.  **"Architectural" Comparison: Imperative vs Declarative**

  Below I detail the major differences between both interfaces:
  
  - `ISourceGenerator`: Exposes two methods: `Initialize` and `Execute`, along with an implementation of `ISyntaxReceiver` or `ISyntaxContextReceiver`. Through `ISyntaxReceiver`, all syntax trees in a compilation are traversed in an imperative way, to collect data from the nodes, and subsequently invokes the `Execute` method, which receives the complete compilation and the populated "receiver" to perform the generation. This is an imperative, and event-based model.
  - `IIncrementalGenerator`: It only contains the `Initialize` method, within which the developer declaratively writes a flow of transformations, in a syntax similar to LINQ. This flow describes how data is moved from the sources (C Sharp code or other files) to the generated code.
      
2.  **Lower performance of `ISourceGenerator`**
The performance problem has to do with the fact that every time a key is pressed and a change is made to the code, the `Execute` method of `ISourceGenerator` is called, which forces the re-evaluation of the entire logic, slowing down the IDE in almost all cases. `IIncrementalGenerator` solves this problem, and allows **Roslyn** to use **Memoization** of each stage, to increase efficiency and only requires to be executed for changes in the data input that invalidate the previously made cache. In addition, `IIncrementalGenerator` separates the initial stage that performs a syntactic check, from the more expensive one which is the transformation. This last stage involves semantic analysis, and that is where reducing the focus of the analysis to the minimum offers the greatest benefits. This point makes it possible for the compiler to run the generator on many nodes, but only invoke the transformation on those that were filtered in the first stage.
      

<div id="generator-elements"\>

### E. Elements of a Code Generator

1.  **The Entry Point**
The only entry point of a Code Generator is the `Initialize` method. The `IncrementalGeneratorInitializationContext` parameter offers access to the different data providers that are the basis of every Roslyn generator.
The available providers, among others, are:
  - `SyntaxProvider`: Allows querying of syntax trees
  - `CompilationProvider`: Allows access to the complete compilation, including semantic information.
  - `AdditionalTextsProvider`: For reading other files in the project (json, txt, xml, etc.).

2.  **Identification of resources**
To trigger code generation, it is first necessary to identify classes, methods, or other elements in the source code. For this, `SyntaxProvider` provides the `CreateSyntaxProvider` method which consists of two parameters:
  - **The Predicate** `(Func<SyntaxNode, CancellationToken, bool>)`: It consists of a syntactic analysis to quickly discard nodes that are not of interest. This step does not contain semantic information.
  - **The Transformation** `(Func<GeneratorSyntaxContext, CancellationToken, T>)`: This delegate is the second step, which does have semantic knowledge. It is only invoked for the nodes that have passed the previous filter (the **Predicate** analysis). The `GeneratorSyntaxContext` argument it receives as a parameter provides access to the Semantic Model, for a deep analysis of specific nodes now. This is where checks would be made such as verifying which interface a class implements or what base type it inherits from, if there are arguments to consider, etc.

3.  **Code generation**. 
The main mechanism for code generation consists of registering a delegate responsible for generating the code based on the filtering performed in the previous step. For this, `IncrementalGeneratorInitializationContext` has the `RegisterSourceOutput(IncrementalValueProvider<TSource> source, Action<SourceProductionContext, TSource> action)` method which will execute the delegate and finally add the generated code to the compiler.
      

<div id="identification-strategies"\>

### F. Strategies for Identifying Generation Targets

There are several strategies to identify the elements of the code that should trigger code generation, and I am going to detail the main ones:

1.  **By Marker Attribute (Recommended)**
This is the most common, efficient, and recommended pattern, although not the one I will exemplify in this article as there is plenty of documentation all over the internet. Instead of using `CreateSyntaxProvider` manually, the optimized helper method `context.SyntaxProvider.ForAttributeWithMetadataName()` should be used. This method is specifically designed for this use case and offers high performance.

```csharp

// Example of using ForAttributeWithMetadataName
var provider = context.SyntaxProvider.ForAttributeWithMetadataName(
    "My.Namespace.MyMarkerAttribute",
    (node, _) => node is ClassDeclarationSyntax, // The predicate I mentioned before, which in this case is optional
  	(ctx, _) => (ClassDeclarationSyntax)ctx.TargetNode); // The transformation, which will be described in detail later.
```

So that the marker attribute is available in the consuming project without the need for a separate assembly reference, or expecting the programmer to write it every time, its source code can be injected directly into the compilation using `context.RegisterPostInitializationOutput` (it will be used later).

2.  **By Interface Implementation**
This strategy requires semantic analysis (and is the one I will use as an example), so the check must be performed in the transformation stage.

  - **Predicate**: An efficient predicate could be `(node, _) => node is ClassDeclarationSyntax c && c.BaseList is not null`. This quickly filters classes that extend from another type (classes or interfaces).

  - **Transformation**: In the transformation delegate, the `INamedTypeSymbol` of the class is obtained through `context.SemanticModel.GetDeclaredSymbol(classDeclarationSyntax)`. Then, the `symbol.AllInterfaces` collection is inspected. Now, if this collection contains the interface we are looking for, then the node is a candidate for generation. The comparison should be made using the full and qualified metadata name of the interface for greater robustness, since a medium or even large project could have multiple interfaces with the same name in different namespaces.
This method will be analyzed in more detail later, as it is the most 'complex' to implement.

3.  **By Other Syntactic or Semantic Cues**
The predicate and transformation delegates can be adapted for any other criteria, such as finding classes that inherit from a specific base class (by inspecting `symbol.BaseType`), methods with particular names, properties of a certain type, etc. If you already have experience with Reflection, the criteria can be applied here as well.
  

<div id="practical-implementation"\>

## II. Practical Implementation

Now, let's get to work with the implementation of a code generator that synthesizes everything mentioned above.

  
1.  **Scenario and configuration**
  - **Objective**: Create a generator that finds all concrete classes in an assembly that implement the marker interface `IRepository`. This sheds some light on how it would be possible to simplify many typical patterns. 
The generator will create an extension method for `IServiceCollection` to register each of the classes in the DI container with a **Scoped** lifetime.
  - **Configuration**: This example will also demonstrate adding a marker interface `public interface IRepository()` so that you don't have to rely on the developer to do it themselves. The generator will look for classes that implement this interface.

2.  **Building the Generator Pipeline**

> The following code will use a few lines for exemplification only, but the full implementation can be found [in this repository](https://github.com/pablomederos/SourceGeneratorsExample).

The process is divided into defining the generator class and building the processing pipeline.
Visual Studio and other IDEs, as well as the Dotnet CLI, already have a template to create the project with a basic configuration. You can start from there, or delete the automatically generated objects and replace them with the code I show below.
  
**Example in RIDER**:
  
![generator.png](/generator.png =800x)

1.  **Generator Class**: A generator class must implement the `IIncrementalGenerator` interface, and will be decorated with the `[Generator]` attribute

```csharp
[Generator]
public class RepositoryRegistrationGenerator : IIncrementalGenerator
{
    public void Initialize(IncrementalGeneratorInitializationContext context)
    {
        // The pipeline will be defined here.
    }
}
```

2.  **Defining the Pipeline**: Inside the Initialize method, the pipeline is built step by step.

  - Step 1: **Generate a marker interface**.
      As I mentioned before, you can use an interface, an attribute or other features of the source code. In this case, assuming that the source code does not have an element to mark the generation triggers, an interface will be generated that can be implemented to "mark" the code.
  

```csharp
public const string MarkerNamespace = "SourceGeneratorExample";
public const string MarkerInterfaceName = "IRepository";
public const string MarkerFullyQualifiedName = $"{MarkerNamespace}.{MarkerInterfaceName}";
private const string Source = 
      $$"""
        // <auto-generated/>
        namespace {{MarkerNamespace}} {
            public interface {{MarkerInterfaceName}} { }
        }
        """;
    
public void Initialize(IncrementalGeneratorInitializationContext context)
{
    context.RegisterPostInitializationOutput(ctx => 
        ctx.AddSource(
            $"{MarkerFullyQualifiedName}.g.cs",
            SourceText.From(Source, Encoding.UTF8))
        );
    ...
}
```

Although for simplicity this example was made using an interpolated string to create the marker interface, the same result could be obtained by using **Syntax Trees**. The code in the aforementioned repository uses that strategy to illustrate what was said, but it was worth simplifying the example.
      
  - Step 2: **Predicate to find candidates.**
    We use `CreateSyntaxProvider` to find all class declarations that are not abstract and that have a list of base types. That is, we only want concrete classes.

```csharp
public void Initialize(IncrementalGeneratorInitializationContext context)
{
    ...
            
    IncrementalValuesProvider<ClassDeclarationSyntax> classDeclarations = CollectClasses(context)
            .WithTrackingName("CheckClassDeclarations");
                
    ...
}

private static IncrementalValuesProvider<ClassDeclarationSyntax> CollectClasses (
        IncrementalGeneratorInitializationContext context
    )
{
    IncrementalValuesProvider<ClassDeclarationSyntax> classDeclarations = context
        .SyntaxProvider
        .CreateSyntaxProvider(
            predicate: static (node, _) => 
                node is ClassDeclarationSyntax { BaseList: not null } @class
                && @class
                    .Modifiers
                    .All(m => !m.IsKind(SyntaxKind.AbstractKeyword)),
            transform: static (ctx, _) => ctx.Node as ClassDeclarationSyntax
        )
        .Where(static @class => @class is not null)!;
    return classDeclarations;
}
```

  - Step 3: **Transformation to identify implementations of IRepository.**
  
We combine the candidates with the `CompilationProvider` to be able to perform the semantic analysis mentioned earlier. In the transformation, it is checked if the class implements the interface we created earlier `IRepository` and, if so, the necessary information is extracted to an immutable and equatable DTO (Data Transfer Object), as will be discussed later.
Null results are filtered and collected in an ImmutableArray. This has some important nuances that I will mention later, but for now I simplify the example.

```csharp
public void Initialize(IncrementalGeneratorInitializationContext context)
{
...
            
    IncrementalValueProvider<ImmutableArray<RepositoryToRegister?>> repositoryClasses = 
        FilterRepositories(context, classDeclarations)
            .WithTrackingName("CheckValidClasses");
            
    ...
}
        
private static IncrementalValueProvider<ImmutableArray<RepositoryToRegister?>> FilterRepositories(
    IncrementalGeneratorInitializationContext context,
    IncrementalValuesProvider<ClassDeclarationSyntax> classDeclarations
)
{
    IncrementalValuesProvider<RepositoryToRegister?> repositoryClasses = classDeclarations
        .Combine(context.CompilationProvider)
        .Select<(ClassDeclarationSyntax, Compilation), RepositoryToRegister?>((data, cancellationToken) =>
        {
            (ClassDeclarationSyntax classDeclaration, Compilation compilation) = data;
            SemanticModel semanticModel = compilation
                .GetSemanticModel(classDeclaration.SyntaxTree);
            INamedTypeSymbol? classSymbol = semanticModel
                .GetDeclaredSymbol(classDeclaration, cancellationToken);
                    
            if(classSymbol is null) return null;
                    
            bool implementsRepository = classSymbol
                .AllInterfaces
                .Any(i => 
                    i.ToDisplayString() == RepositoryMarker.MarkerFullyQualifiedName
                );
                    
            if (!implementsRepository) return null;
                    
            return new RepositoryToRegister(
                @namespace: classSymbol
                    .ContainingNamespace
                    .ToDisplayString(), 
                className: classSymbol.Name,
                assemblyName: compilation.AssemblyName ?? string.Empty
            );
        }
    );
            
IncrementalValueProvider<ImmutableArray<RepositoryToRegister?>> repositories = 
        repositoryClasses
            .Where(static data => data is not null)
            .Collect();
    return repositories;
}

internal readonly struct RepositoryToRegister
{
    public string Namespace { get; } 
    public string ClassName { get; }
    public string AssemblyName { get; }

    public RepositoryToRegister(string @namespace, string className, string assemblyName)
    {
        Namespace = @namespace;
        ClassName = className;
        AssemblyName = assemblyName;
    }

}
```

  - Step 4: **Generating the Extension Method**
Finally, we register a delegate that will take the collection of repositories and generate the source code file.

```csharp
public void Initialize(IncrementalGeneratorInitializationContext context)
{
    ...
            
    context.RegisterSourceOutput(
        repositoryClasses, 
        GenerateServicesRegistration
    );
}
        
private static void GenerateServicesRegistration(
    SourceProductionContext spc,
    ImmutableArray<RepositoryToRegister?> source
)
{
    if (source.IsDefaultOrEmpty)
        return;

    // Get a unique name for the extension class based on the assembly name.
    string assemblyName = source.First()!.Value.AssemblyName.Replace(".", "_");

    const string usingDirectives = """

                                   using Microsoft.Extensions.DependencyInjection;
                                   """;

    var registrationCalls = new StringBuilder();
    foreach (RepositoryToRegister repo in source
                 .Where(r => r.HasValue)
                 .Select(r => r!.Value))
    {
        registrationCalls.AppendLine(
           $"\t\t\tservices.AddScoped<global::{repo.Namespace}.{repo.ClassName}>();");
    }
            
    var sourceCode = $$"""
                       // <auto-generated/>
                       #nullable enable
                       {{usingDirectives}}
                       namespace MyApplication.Extensions
                       {
                           public static class {{assemblyName}}ServiceCollectionExtensions
                            {
                               public static IServiceCollection AddRepositoriesFrom{{assemblyName}}(this IServiceCollection services)
                               {
                       {{registrationCalls}}
                                   return services;
                               }
                           }
                       }
                       """;

    spc.AddSource($"{assemblyName}RepositoryRegistrations.g.cs",
        SourceText.From(sourceCode, Encoding.UTF8)
    );
}
```

-----

<div id="testing-generator"\>

## III. Testing the code generator

A code generator is a piece of software that must be as robust and reliable as any other. I will go on to detail how to perform some tests for the generator we just tested.
For the purposes of this documentation, two approaches will be used: **Snapshot Testing** and typical **Assertions**.

1.  **Snapshot Testing with** [`Verify`](https://github.com/VerifyTests/Verify)
**Snapshot Testing** is an ideal technique for code generators. Instead of writing manual assertions about the generated text, the **Verify framework** captures the complete output of the generator (both the generated code and the diagnostics) and saves it to a `.verified.cs` file. In subsequent test runs, the new output is compared to this "approved" file. If there is any difference, the test fails, which allows for effective detection of regressions.
  

  - **Example**:
To initialize Verify support, a `ModuleInitializer` is required
  

```csharp
using System.Runtime.CompilerServices;
using VerifyTests;

public static class ModuleInitializer
{
    [ModuleInitializer]
    public static void Init() => VerifySourceGenerators.Initialize();
}
```

A typical test would look like this *(Example with XUnit)*:
  

```csharp
public class RepositoryRegistrationGeneratorTests
{
    private readonly VerifySettings _verifySettings = new ();

    public RepositoryRegistrationGeneratorTests()
    {
        _verifySettings.UseDirectory("TestsResults");
    }
    
    [Fact]
    public Task GeneratesRepositoryRegistration_WhenRepositoryExists()
    {
        // 1. Arrange: Define the input source code
        const string source = $$"""
                                using {{RepositoryMarker.MarkerNamespace}};
                                namespace MyApplication.Data
                                {
                                    public class UserRepository : {{RepositoryMarker.MarkerInterfaceName}} { }
                                    public class ProductRepository : {{RepositoryMarker.MarkerInterfaceName}} { }
                                    public abstract class BaseRepository : {{RepositoryMarker.MarkerInterfaceName}} { } // Should not be registered
                                    public class NotARepository { } // Should not be registered
                                }
                                """;

        // 2. Act: Run the generator
        var compilation = CSharpCompilation.Create(
            "MyTestAssembly",
            [ CSharpSyntaxTree.ParseText(source) ],
            [ MetadataReference.CreateFromFile(typeof(object).Assembly.Location) ]
        );

        GeneratorDriver driver = CSharpGeneratorDriver
            .Create(new RepositoryRegistrationGenerator())
            .RunGenerators(compilation);

        // 3. Assert: Verify the output with Verify
        // This test should generate the registrations for 
        // UserRepository and ProductRepository in the extension
        return Verifier
            .Verify(
                driver.GetRunResult().Results.Single(),
                _verifySettings
            );
    }
}
```

The first time this test is run, it will fail and create two files: *.received.cs (the actual output) and *.verified.cs (the snapshot file (like a state capture)). The developer must review the *.verified file to ensure it is correct and then accept it.

`CSharpCompilation.Create` will allow the creation of a compilation, similar to how it would work on any source code.
`CSharpGeneratorDriver` will be in charge of running the generator on the compilation and generating the new source code from the generator.

2.  **Testing Incrementality with assertions**

> Although this code uses the typical assertions included in the testing framework, in the repository, example code was added for using `Verify` as was done previously.

This is the most critical test for an incremental generator. It demonstrates that the cache is working correctly and that the generator is not doing unnecessary work. This is where using `IIncrementalGenerator` offers the greatest performance benefit.
The steps to test incrementality are basically the following:

  - **Marking the Pipeline Steps**: In the generator's code, `.WithTrackingName("StepName")` is added to the key stages of the pipeline that you want to monitor.

  - **Configuring the GeneratorDriver**: In the test, the `GeneratorDriver` is created with the `trackIncrementalGeneratorSteps: true` option.

  - **Performing Multiple Runs**:
    - **Run 1**: The generator is run on an initial compilation.
    - **Run 2**: A new compilation is created by adding a trivial change to the first one (for example, a comment) and the generator is run again.
      

  - **Assertion on the Execution Reason**: The result of the second run is obtained and the reason (**Reason**) why the steps were executed is checked. If the cache worked, the reason should be `IncrementalStepRunReason.Cached` or `IncrementalStepRunReason.Unchanged`.

```csharp
public class RepositoryRegistrationGeneratorTests
{   
    [Fact]
    public void IncrementalGenerator_CachesOutputs()
    {
        // 1. Arrange: Define the input source code
        const string initialSource = $$"""
                                       using {{RepositoryMarker.MarkerNamespace}};
                                       namespace MyApplication.Data
                                       {
                      _is_active                  public class UserRepository : {{RepositoryMarker.MarkerInterfaceName}} { }
                                       }
                                       """;
        SyntaxTree initialSyntaxTree = CSharpSyntaxTree.ParseText(initialSource, path: "TestFile.cs");
        var initialCompilation = CSharpCompilation.Create(
            "IncrementalTestAssembly",
            [ initialSyntaxTree ],
            [ MetadataReference
                .CreateFromFile( typeof(object).Assembly.Location ) 
            ]
        );

        // 2. Act: Run the generator
        var generator = new RepositoryRegistrationGenerator();
        GeneratorDriver driver = CSharpGeneratorDriver
            .Create(
                generators: [generator.AsSourceGenerator() ],
                driverOptions: new GeneratorDriverOptions(
                    IncrementalGeneratorOutputKind.None, 
                    trackIncrementalGeneratorSteps: true
                    )

            )
            .RunGenerators(initialCompilation);

            
        // 3. Arrange: Add a class that is not registerable
        const string modifiedSource = $$"""
                                          using {{RepositoryMarker.MarkerNamespace}};
                                          namespace MyApplication.Data
                                          {
                                              public class UserRepository : {{RepositoryMarker.MarkerInterfaceName}} { }
                                                  
                                              // This change should not cause the output to be regenerated
                                              // because the class does not implement the marker interface.
                                              public class NotARelevantChange { }
      _is_active                           }
                                          """;
        SyntaxTree modifiedSyntaxTree = CSharpSyntaxTree
            .ParseText(modifiedSource, path: "TestFile.cs");
        CSharpCompilation incrementalCompilation = initialCompilation
            .ReplaceSyntaxTree(initialSyntaxTree, modifiedSyntaxTree);
            
            
        // 4. Act: Run the generator
        driver = driver.RunGenerators(incrementalCompilation);
      _is_active GeneratorRunResult result = driver
            .GetRunResult()
            .Results
            .Single();
            
  
        // 5. Assert: The [CheckClassDeclarations] step
            
        var allOutputs = result
            .TrackedOutputSteps
            .SelectMany(outputStep => outputStep.Value)
            .SelectMany(output => output.Outputs);
            
        (object Value, IncrementalStepRunReason Reason) output = Assert.Single(allOutputs);
        Assert.Equal(IncrementalStepRunReason.Cached, output.Reason);
            
        var assemblyNameOutputs = result
            .TrackedSteps["CheckClassDeclarations"]
            .SelectMany(it => it.Outputs);
            
        output = Assert.Single(assemblyNameOutputs);
        Assert.Equal(IncrementalStepRunReason.Modified, output.Reason);
        var syntaxOutputs = result
            .TrackedSteps["CheckValidClasses"]
            .Single()
            .Outputs;
            
        output = Assert.Single(syntaxOutputs);
        Assert.Equal(IncrementalStepRunReason.Cached, output.Reason);
    }
}
```

-----

<div id="cache-performance"\>

## IV. The performance offered by the cache

Understanding how the generator's cache works could be the difference between an ultra-fast generator and one that blocks the IDE. That's why it was important to perform the cache test from the previous section.

<div id="cache-engine"\>

#### A. The Cache Engine: Memoization in the Pipeline

As mentioned earlier, the pipeline of an incremental generator is a data flow graph. The Roslyn engine memoizes (caches) the output of each node in this graph. In subsequent runs, if the inputs to a node are considered identical to those of the previous run (via an equality check), the cached output is used instantly, and downstream nodes are not re-executed unless other of their inputs have changed. The key to the whole system lies in that "equality check."  

<div id="isymbol-performance"\>

#### B. `ISymbol`: Its Effect on Performance

This is the most common mistake you can make when writing an incremental generator.

  - **The Problem**: `ISymbol` objects (representing types, methods, etc.) and `Compilation` objects are not stable between compilations as they depend on the source code they represent. Even for the exact same source code, a new compilation pass (triggered by a keystroke, for example) will generate new `ISymbol` instances that are not equal by reference to the old ones.

  - **The Consequence**: If an `ISymbol` or any object containing it (like a `ClassDeclarationSyntax` that is combined with the `CompilationProvider`) is used as data within an `IncrementalValueProvider`, the cache's equality check will always fail. This forces the pipeline to re-run from that point forward with every change, completely nullifying the purpose of incremental generation.  

  - **Memory Waste**: A serious side effect is that holding references to ISymbol objects in the pipeline can "pin" entire compilations in memory, preventing the garbage collector from releasing them. In large solutions, this leads to terrible memory consumption by the IDE process (e.g., `RoslynCodeAnalysisService`), with reports of using 6-10 GB of RAM or more. [Issue on GitHub](https://github.com/dotnet/roslyn/issues/62674)

<div id="equatable-dto-pattern"\>

#### C. Best Practice: The Equatable DTO Pattern

The definitive and non-negotiable solution to this problem is to transform the semantic information into a simple, immutable, and equatable Data Transfer Object (DTO) as early as possible in the pipeline, which is what I did in the code example with the `RepositoryToRegister` type.

  - Implementation: Use a `record struct` for the DTO. This provides value-based equality semantics for free and, being a struct, avoids heap allocations for small objects.  

  - Process: In the transformation stage (the second delegate of `CreateSyntaxProvider` or `ForAttributeWithMetadataName`), you should:

  1. **Inspect the ISymbol.**
  2. Extract only the primitive data necessary for generation (names as `string`, flags as `bool`, etc.).
  3. Populate a new instance of the DTO record struct.
  4. **Return the DTO.**
  The ISymbol is discarded immediately and never enters the incremental pipeline's cache.
  

<div id="optimizing-pipeline"\>

#### D. Optimizing the Pipeline Structure

In addition to the DTO pattern, there are other possible structural optimizations.

  - **Collections**: The standard `ImmutableArray<T>` type is not equatable by value; it uses reference equality. Passing it through the pipeline will break the cache. The solution is to use `EquatableArray<T>` (from the CommunityToolkit.Mvvm NuGet package) or wrap the provider with a custom `IEqualityComparer<T>` using the `.WithComparer()` method.  

  - **Combining Providers**: When using `.Combine()`, you should avoid combining with the full `context.CompilationProvider`, as this object changes frequently. It's best to use `.Select()` to extract only the necessary data (for example, `context.CompilationProvider.Select((c,_) => c.AssemblyName)`) and combine with that smaller, more stable provider. The order of combinations can also affect the cache size. I repeat myself in this sense because it is very common to try to pass an `ISymbol` and even the complete compilation instead of only the data required for generation.
      
      

<div id="table-best-practices"\>

#### E. Table: Cache Best Practices for Incremental Generators

The following table summarizes what I consider to be performance "rules," contrasting common anti-patterns with recommended best practices. It serves as a checklist for auditing and optimizing an incremental generator, although everyone will make their own way as they go.

|Concern|Anti-Pattern (Breaks the Cache and Wastes Memory)|Best Practice (Enables the Cache and Saves Memory)|Justification and References|
|-|-|-|-|
|Data Transfer|**IncrementalValueProvider**<**ISymbol**> or **IncrementalValueProvider**<**ClassDeclarationSyntax**>|**IncrementalValueProvider**<**MyEquatableRecordStruct**>|`ISymbol` and `SyntaxNode` objects are not stable between compilations and pin large object graphs. DTOs with value equality are small and stable.|
|Collections|**IncrementalValueProvider**<**ImmutableArray**<**T**>>|**IncrementalValueProvider**<**EquatableArray**<**T**>> or use `.WithComparer()`|**ImmutableArray**<**T**> uses reference equality. **EquatableArray**<**T**< from the **Community Toolkit** provides the structural equality necessary for the cache.|
|Compilation Data|`provider.Combine(context.CompilationProvider)`|`var asm = c.CompilationProvider.Select(...); provider.Combine(asm)`|The entire Compilation object changes on almost every keystroke. Selecting only the necessary data (e.g., the assembly name) creates a much more stable input for the Combine step.|
|Data Model Type|Use a standard `class` with default reference equality for your DTO.|Use a `record` or `record struct` for the DTO.|Records provide compiler-generated value-based equality, which is exactly what the caching mechanism requires to function correctly.|

-----

<div id="conclusion-recommendations"\>

## V. Conclusion and Final Recommendations

  
The journey through incremental code generators reveals a technology that is both powerful and nuanced. `IIncrementalGenerator` has established itself as the cornerstone of compile-time metaprogramming in .NET, not just as an optimization, but as a fundamental enabler for the platform's strategic direction towards performance, efficiency, and AOT compatibility.
This is the first article I've written on this topic, but it won't be the last, as I'd later like to cover other topics such as interceptors, publishing a NuGet package, and best practices and tools that streamline development as well as code review, whether in an independent project or in teamwork.

I believe the key principles to mastering this technology are clear:

  - **Mandatory Adoption:** `IIncrementalGenerator` is not an option, but a requirement for any code generator that cares about performance and developer experience.

  - **Performance is a Pipeline**: Performance is dictated by the construction of a well-structured and cache-aware data pipeline.

  - **The Cache Depends on Equality**: The effectiveness of the cache depends on transforming semantic symbols, which are inherently unstable, into simple, immutable, and equatable DTOs as early as possible.

  - **Robustness Demands Testing**: Correctness and performance must be ensured through a comprehensive test suite that includes both snapshot tests for the output and incrementality tests for cache efficiency.

Below is a best practices checklist for incremental code generator authors, summarizing the critical recommendations discussed throughout this report:

Checklist for Incremental Generator Authors
☑️ **Use** `IIncrementalGenerator`: Always implement `IIncrementalGenerator` and avoid the legacy `ISourceGenerator` interface.

☑️ **Target** *netstandard2.0*: Configure the generator project to target *netstandard2.0* for maximum compatibility.

☑️ **Use the Equatable DTO Pattern**: Never pass ISymbol, Compilation, or SyntaxNode directly through the pipeline. Transform them into record struct DTOs containing only the necessary primitive data.

☑️ **Use ForAttributeWithMetadataName**: For attribute-based detection, always prefer this optimized method over a manual CreateSyntaxProvider.

☑️ **Inject Marker Attributes**: Use `RegisterPostInitializationOutput` to inject the source code of marker attributes into the consumer's compilation.

☑️ **Be Strategic with Combine**: Avoid combining with the full `CompilationProvider`. Instead, use `.Select()` to extract only the necessary information (e.g., `AssemblyName`) and combine with that smaller provider.

☑️ **Use Equatable Collections**: When working with collections, use **EquatableArray**<**T**> or a custom **IEqualityComparer**<**T**> to ensure the cache works.

☑️ **Implement Snapshot Testing**: Use a library like `Verify` to create snapshot tests that validate the correctness of the generated code and diagnostics.

☑️ **Implement Incrementality Tests**: Write specific tests that verify that the pipeline steps are retrieved from the cache (**Reason** == **Cached**/**Unchanged**) on trivial code changes.