---
title: Vertical Slices in .NET
description: Software Architecture in Dotnet: A pragmatic introduction to Vertical Slices
published: true
date: 2025-06-12T12:24:04.321Z
tags: .net, c#, asp.net core, software architecture, software design, vertical slice architecture, minimal apis, applicationparts, mvc controllers, modular monolith, .net architecture, project structure, endpoint discovery, low coupling high cohesion, code maintainability, .net 8
editor: markdown
dateCreated: 2025-06-11T17:56:17.634Z
---

# Vertical Slices in .NET

I. [Introduction to Vertical Slice Architecture in .NET](#introduction)

  - A. [Fundamental Principles of VSA: The Why and the How](#fundamental-principles-of-vsa-the-why-and-the-how)
  - B. [VSA in the .NET Ecosystem: Framework Mechanisms](#vsa-in-the-net-ecosystem-framework-mechanisms)

II. [Implementing Vertical Slices in Projects Separated by Context: The How and Why of Modularization](#implementing-vertical-slices-in-separate-projects)

  - A. [Conceptual Overview: Structuring "Contexts" as Independent Projects](#conceptual-overview)
  - B. [Key Considerations for Project Separation: The How of Integration](#key-considerations-for-project-separation)

III. [Endpoint Exposure Strategies for Vertical Slices in Separate Projects: .NET Mechanisms](#endpoint-exposure-strategies)

  - A. [Using ASP.NET Core ApplicationParts (for MVC Controllers)](#using-aspnet-core-applicationparts)
  - B. [Leveraging Minimal APIs (with Custom Discovery)](#leveraging-minimal-apis)
  - C. [ApplicationParts vs. Minimal APIs for Slices in Separate Projects](#comparative-analysis)
  - C.1 [A more direct example using only extension methods and Minimal APIs](#extension-methods)

IV. [General Advantages and Disadvantages of Vertical Slice Architecture](#in-depth-analysis)

  - A. [Detailed Advantages (The Why Behind its Benefits)](#detailed-advantages)
  - B. [Disadvantages and Common Challenges](#disadvantages-and-common-challenges)

V. [Other Possible Implementation Alternatives in VSA](#brief-mention-of-other-possible-alternatives)

  - A. [Internal Organization of Slices](#internal-organization-of-slices)
  - B. [Direct Communication Between Slices (without an explicit mediator)](#direct-communication-between-slices)
  - C. [Using Source Generators for Registration/Optimization](#using-source-generators-for-registrationoptimization)

VI. [Conclusion and Strategic Recommendations: A Pragmatic Approach with .NET](#conclusion-and-strategic-recommendations)

</br>

<div id="#introduction"\>

## I. Introduction to Vertical Slice Architecture in .NET

Vertical Slice Architecture (VSA) has gained considerable traction in the .NET development community as an alternative to more traditional layered architectural approaches. Its core philosophy is based on organizing application logic around business functionalities or features, called "slices," rather than grouping code by technical affinity into horizontal layers like presentation, business logic, and data access. Each vertical slice ideally encapsulates all the necessary aspects to implement a specific feature, from the user interface (if applicable) to data persistence, cutting across all technical concerns relevant to that particular functionality.

<div id="fundamental-principles-of-vsa-the-why-and-the-how"\>

### Fundamental Principles of VSA: The Why and the How

VSA is based on several key principles that guide its implementation and aim to optimize the code structure for maintainability and evolution:

  - **Use-case Driven:**

      - **Why:** Traditional layer-centric development can scatter the logic of a single functionality across multiple technical components. This makes it difficult to understand and modify a complete feature. VSA seeks to align the code structure with the way the business conceives and requests functionalities.
      - **How:** The system is organized around specific business features or capabilities. Each "slice" represents a use case. This makes it easier to add, modify, or remove functionalities in an isolated manner, as the impact is mainly contained within the slice.

  - **Melting Abstractions:**

      - **Why:** Layered architectures often impose rigid abstractions (e.g., "Controller -\> Service -\> Repository") that do not always add value and can generate repetitive or unnecessarily complex code for simple functionalities.
      - **How:** The goal is to eliminate barriers and forced abstractions between technical components within a slice. A slice contains what is necessary for its operation, allowing for a more direct design adapted to the specific need of the feature. This does not imply the total absence of abstractions, but rather a critique of "rigid rules about dependency management." Abstractions are used where they provide genuine value, not as a dogma.

  - **Axis Of Change:**

      - **Why:** One of the biggest challenges in software maintenance is that a change in one functionality requires modifying code in multiple, not directly related places, increasing the risk of errors. Or that when transitioning from a monolithic to a distributed architecture, it becomes very complex to find all the scattered dependencies of a functionality in each layer.
      - **How:** Software components that tend to change together should reside close to each other in the codebase. When a feature is implemented or modified, most of the changes are localized within its corresponding slice. If modifications to a functionality often require touching code in several horizontal layers (UI, business logic, data), grouping those parts vertically reduces the dispersion of the change. Or, if a functionality needs to be extracted into a microservice, a project or an entire directory can simply be extracted, without the need to analyze every line of code within the solution.

The primary goal of VSA is to maximize cohesion within each slice (all elements of the slice are strongly related) and minimize coupling between different slices (the slices are as independent as possible).

The popularization of VSA in .NET could perhaps be attributed, though not exclusively, to Jimmy Bogard (creator of AutoMapper, MediatR, and Respawn). His argument is that traditional layered architectures can be too generic and not optimal for most of the individual requests of a system. You can read more about this topic at this link: [Vertical Slice Architecture](https://www.jimmybogard.com/vertical-slice-architecture/).

<div id="vsa-in-the-net-ecosystem-framework-mechanisms"\>

### VSA in the .NET Ecosystem: Framework Mechanisms

In the context of .NET projects, Vertical Slice Architecture relies on features and patterns of the framework itself:

  - **Minimal APIs and ASP.NET Core MVC:**

      - **Why:** HTTP entry points are needed to expose the functionalities of the slices (if it's a Rest API, for example).
      - **How:** VSA can be implemented using both Minimal APIs and traditional ASP.NET Core MVC controllers. Minimal APIs (.NET 6+) align well with VSA's philosophy of reducing boilerplate code and focusing on the endpoint and its logic. They allow for defining endpoints with less ceremony. MVC controllers remain a robust option, especially for scenarios with more complex MVC functionalities.

  - **Dependency Injection (DI):**

      - **Why:** To achieve low coupling and testability, components (like endpoints and business logic handlers) should not create their dependencies directly.
      - **How:** The built-in DI container in ASP.NET Core is used to register and resolve the services and handlers that each slice needs. Endpoints (controllers or Minimal APIs) receive their dependencies (feature handlers, slice-specific infrastructure services) through DI.

  - **Project Structure:**

      - **Why:** For better organization and isolation, especially in large applications.
      - **How:** You can create folders per feature within the same project, or, as this note focuses on, separate the slices into independent class library projects (.csproj), grouped by business context.

<div id="implementing-vertical-slices-in-separate-projects"\>

## II. Implementing Vertical Slices in Projects Separated by Context: The How and Why of Modularization

Separating slices into independent class library projects, grouped by "business context," is a strategy for organizing larger VSA applications. The main application (ASP.NET Core web API) acts as an assembler.

<div id="conceptual-overview"\>

### Conceptual Overview: Structuring "Contexts" as Independent Projects

**Why:**

  - **Isolation and Clear Boundaries:** Each business context has its own project, establishing compilation boundaries and reducing the risk of unwanted coupling between different contexts. This is similar to "Bounded Contexts" from Domain-Driven Design.
  - **Organization for Teams:** It makes it easier for different teams to work on different contexts with less interference.
  - **Potential for Evolution:** Although deployed as a monolith, this modular structure can facilitate the extraction of modules into microservices in the future if necessary.

**How:**
A typical structure:

  - `MainApiProject.csproj`: ASP.NET Core project.
  - `ContextA.Features.csproj`: Class library with slices for Context A.
  - `ContextB.Features.csproj`: Class library with slices for Context B.
  - `SharedKernel.csproj`: Shared code (utilities, cross-cutting interfaces, common DTOs if strictly necessary and well-defined).

Inter-context communication, if necessary, should be explicit, usually through interfaces defined in a shared project or exposed by the public API of each context module. The main challenge is how the `MainApiProject` discovers and registers the endpoints defined in the context projects.
Personally, I prefer to use and abuse extension methods that I can then add almost transparently to my `MainApiProject`.

<div id="key-considerations-for-project-separation"\>

### Key Considerations for Project Separation: The How of Integration

  - **Dependency Management:** The main API project references the context projects.
  - **Feature/Endpoint Discovery:**
      - **Why:** Endpoints (MVC Controllers or Minimal APIs) defined in the context projects must be accessible via HTTP. The main project needs to know about them.
      - **How:** `ApplicationParts` for MVC and Minimal APIs will be explored, perhaps with reflection techniques, code generators, or simple extension methods.
  - **Code Sharing:**
      - **Why:** Avoid excessive duplication of truly common code.
      - **How:** Use a `SharedKernel` with caution to avoid creating a "god object." Share only what is stable and genuinely reusable.
  - **Cross-Cutting Concerns:**
      - **Why:** Functionalities like logging, authorization, and validation must be applied consistently.
      - **How:** Use ASP.NET Core middleware, action/endpoint filters, or decorators implemented manually on the feature handlers. These mechanisms are part of the .NET framework.
  - **Configuration and Startup:**
      - **Why:** The services and endpoints of each context must be registered in the main application.
      - **How:** In `Program.cs`, the registration of services and mapping of endpoints from the context projects is configured, either directly (not recommended) or using extension methods.

<div id="endpoint-exposure-strategies"\>

## III. Endpoint Exposure Strategies for Vertical Slices in Separate Projects: .NET Mechanisms

When slices reside in separate projects, the main API project needs a mechanism to discover and expose their HTTP endpoints.

<div id="using-aspnet-core-applicationparts"\>

### Using ASP.NET Core ApplicationParts (for MVC Controllers)

**Why `ApplicationParts` exists:** ASP.NET Core MVC needs a way to find components like Controllers, Views, View Components, etc., which may be in the main assembly or in referenced assemblies (like the context projects). `ApplicationParts` is the abstraction that allows this.

**How it works:** The `ApplicationPartManager` tracks `ApplicationParts` (an `AssemblyPart` encapsulates an assembly) and `IFeatureProvider`s (like `ControllerFeatureProvider`) to discover these components. By default, MVC examines the dependencies of the main project and discovers controllers in referenced assemblies.

**Advantages for VSA with Separate Projects (using MVC Controllers):**

  - **Native Mechanism:** It's the built-in way for ASP.NET Core to discover MVC controllers.
  - **Automatic Discovery (with project references):** If context projects are referenced, their MVC controllers are usually discovered automatically.
  - **Centralized Configuration:** Customization is done in `Program.cs`.

**Disadvantages and Limitations:**

  - **Coupled to Traditional MVC:** It does not apply to Minimal APIs (though this might not be a requirement).
  - **MVC Overhead:** It involves the entire MVC framework. That is, when you choose to use an MVC Controller for an endpoint, not only is the action method executed, but the entire machinery and lifecycle that the ASP.NET Core MVC framework uses to process a request is also activated.

**Minimalist Code Example (Illustrative):**

```csharp
//FeatureAController.cs in a separate project
using Microsoft.AspNetCore.Mvc;

namespace ContextA.Features.Controllers;

[ApiController]
[Route("[controller]")]
public class FeatureAController: ControllerBase
{
    public IActionResult Index()
    {
        return Ok("Hello world from FeatureA!");
    }
}
```

**Program.cs**:

```csharp
WebApplicationBuilder builder = WebApplication.CreateBuilder(args);
IServiceCollection services = builder.Services;

services
    .AddControllers()
    .AddApplicationPart(
        typeof(ContextA.Features.Controllers.FeatureAController).Assembly
    );

WebApplication app = builder.Build();

app.MapControllers();

app.Run();
```

or more configurable:

```csharp
using Microsoft.AspNetCore.Mvc.ApplicationParts;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);
IServiceCollection services = builder.Services;

services.AddControllers()
    .ConfigureApplicationPartManager(apm =>
    {
        // Example of how a dynamically loaded assembly could be added:
        // var pluginAssembly = Assembly.LoadFrom("path/to/ContextA.Features.dll");
        // apm.ApplicationParts.Add(new AssemblyPart(pluginAssembly));

        // Example of how an assembly could be removed if necessary:
        // var assemblyToExclude = apm.ApplicationParts
        //                             .FirstOrDefault(part => part.Name == "AssemblyToExclude");
        // if (assemblyToExclude!= null)
        // {
        //     apm.ApplicationParts.Remove(assemblyToExclude);
        // }
        apm
            .ApplicationParts
            .Add(
                new AssemblyPart(
                    typeof(ContextA.Features.Controllers.FeatureAController).Assembly
                )
            );
    });

WebApplication app = builder.Build();

app.MapControllers();

app.Run();
```

Or through extension methods:

```csharp
// FeatureAExtensions.cs
// I usually place one in each project so that each functionality
// is responsible for registering itself.

using Microsoft.Extensions.DependencyInjection;
using System.Reflection;

namespace ContextA.Features.Extensions;

public static class FeatureAExtensions
{
    public static IMvcBuilder AddFeatureA(this IMvcBuilder builder)
    {
			// It will discover all controllers it contains
        builder
            .AddApplicationPart(
                Assembly.GetExecutingAssembly()
            );

        return builder;
    }
}

// Program.cs
using ContextA.Features.Extensions;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);
IServiceCollection services = builder.Services;

// Required for FeatureA
services
    .AddControllers()
    .AddFeatureA();

// Optional for FeatureA
services
    .AddFeatureAServices();

WebApplication app = builder.Build();

app.MapControllers();

app.Run();

```

This example is based on the concepts described above. The `ApplicationPartManager` allows adding `AssemblyPart` for assemblies that are not direct references, which is key for a plugin system or for loading feature modules more dynamically.

<div id="leveraging-minimal-apis"\>

### Leveraging Minimal APIs (with Custom Discovery)

**Why Minimal APIs:** They offer a concise syntax for defining HTTP endpoints, aligning with VSA's idea of reducing boilerplate and keeping endpoint logic cohesive. Although I don't completely agree with the first point, I do believe the latter is an indisputable benefit.

**Why custom discovery is needed:** ASP.NET Core does not have an automatic mechanism like `ApplicationParts` for discovering Minimal APIs defined in external assemblies. However, we can use extension methods, or other mechanisms mentioned before. How elaborate it is will depend on the needs of each project.

**How to implement custom discovery:**

  - **Convention and Reflection:**

      - **How:** Define a marker interface (e.g., `IEndpointDefinition`) in a shared project. In each context project, classes that define Minimal APIs implement this interface. In the main project's `Program.cs`, use reflection to scan the context assemblies, find types that implement `IEndpointDefinition`, instantiate them, and call a conventional method (e.g., `MapEndpoints(IEndpointRouteBuilder app)`) to register the routes.
      - **Why:** It allows for dynamic discovery without coupling the main project to each individual endpoint. Reflection is a native .NET capability.

  - **Source Generators:**

      - **How:** Instead of runtime reflection, a source generator can analyze the context projects at compile time, identify the endpoints (based on attributes or conventions), and generate the registration code directly in the main project. For example, by creating custom extension methods.
      - **Why:** It improves startup performance by avoiding reflection and can be more compatible with Ahead-Of-Time (AOT) compilation scenarios.

**Advantages for VSA with Separate Projects (using Minimal APIs):**

  - **Lightweight and Potential Performance:** Less overhead than MVC.
  - **Philosophical Alignment with VSA:** Encourages small, cohesive endpoints.
  - **Flexibility in Discovery:** The mechanism adapts to the needs.

**Disadvantages and Limitations:**

  - **Implementation Effort for Discovery:** Requires additional code (reflection, source generators, or at least extension methods considering maintainability) for discovery.
  - **Maturity for Advanced Features:** Some complex MVC features may require more work to replicate in Minimal APIs, although this is continuously improving.

**Minimalist Code Example (Discovery of Minimal APIs by Reflection):**

In `SharedKernel.csproj` (or similar):

```csharp
// SharedKernel/Api/IEndpointDefinition.cs
using Microsoft.AspNetCore.Routing;

namespace SharedKernel.Api;

public interface IEndpointDefinition
{
    void MapEndpoints(IEndpointRouteBuilder app);
}

// SharedKernel/Api/EndpointRegistrationExtensions.cs
using Microsoft.AspNetCore.Builder;
using System.Reflection;

namespace SharedKernel.Api;

public static class EndpointRegistrationExtensions
{
    public static WebApplication MapAllEndpoints(
        this WebApplication app, params Assembly[] assembliesToScan)
    {
        var endpointDefinitions = new List<IEndpointDefinition>();
        foreach (Assembly assembly in assembliesToScan)
            endpointDefinitions
                .AddRange(
                    assembly
                        .ExportedTypes
                        .Where(t => typeof(IEndpointDefinition)
                            .IsAssignableFrom(t) 
                            && t is { 
                                IsInterface: false, 
                                IsAbstract: false 
                            }
                        )
                        .Select(Activator.CreateInstance)
                        .Cast<IEndpointDefinition>()
                );

        foreach (IEndpointDefinition definition in endpointDefinitions)
        {
            definition.MapEndpoints(app);
        }
        return app;
    }
}
```

In `ContextB.Features.csproj`:

```csharp
// ContextB.Features/FeatureB.cs

namespace ContextB.Features.Api;

public sealed class FeatureB : IEndpointDefinition
{
    // Only the default constructor is required

    public void MapEndpoints(
        IEndpointRouteBuilder app
    )
    {
        app.MapGet("/FeatureB", 
            (SomeService someService) => someService.GetHi()
        );
    }
}
```

In `MainApiProject/Program.cs`:

```csharp
// MainApiProject/Program.cs

using ContextB.Features.Extensions;
using SharedKernel.Api;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);
IServiceCollection services = builder.Services;

// Optional if services need to be registered
services
    .AddFeatureBServices();

WebApplication app = builder.Build();

app.MapAllEndpoints(
    typeof(ContextB.Features.Api.FeatureB).Assembly
);

app.Run();
```

This example illustrates the how (reflection to find implementations of `IEndpointDefinition`) and the why (need for an explicit registration mechanism for Minimal APIs in separate assemblies).

<div id="extension-methods"\>

#### A more direct example using only extension methods and Minimal APIs

In `ContextC.Features.csproj`:

```csharp
// FeatureC.cs
using ContextC.Features.Services;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;

namespace ContextC.Features.Api;

public static class FeatureC
{
    public static void MapFeatureCEndpoints(
        this IEndpointRouteBuilder app
    )
    {
        app
            .AddGet()
            //.AddPost();
            //.AddPut();
            //.AddPatch();
            //.AddDelete();
            ;
    }

    // Each HTTP method could have its own class for more control
    private static IEndpointRouteBuilder AddGet(this IEndpointRouteBuilder app)
    {
        app.MapGet("/FeatureC", 
            (SomeService someService) => someService.GetHi()
        );

        return app;
    }
}
```

In `MainApiProject/Program.cs`:

```csharp
using ContextC.Features.Api;
using ContextC.Features.Extensions;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);
IServiceCollection services = builder.Services;

// Optional
services
    .AddFeatureCServices();

WebApplication app = builder.Build();

app.MapFeatureCEndpoints();

app.Run();
```

This approach is more direct and also more of an all-rounder, as it doesn't use Reflection and doesn't depend on an external project for endpoint discovery. The performance might be slightly better during application startup, but there would be no differences during the regular execution of the process. Over-engineering is also avoided in most cases.

<div id="comparative-analysis"\>

### ApplicationParts vs. Minimal APIs for Slices in Separate Projects

| Feature/Aspect | ApplicationParts (with MVC Controllers) | Minimal APIs (with custom discovery via reflection/source generators/extension methods) | Why and How it Impacts VSA with Separate Projects |
| -- | -- | -- | -- |
| **Discovery Mechanism** | **How:** Integrated (`ApplicationPartManager` scans for `ControllerBase` types). **Why:** MVC has a rich model of features that need to be discovered. | **How:** Manual implementation (reflection on interfaces/attributes or source generators). **Why:** Minimal APIs is "minimal," it doesn't include complex discovery of external assemblies by default. | `ApplicationParts` is "ready to use" for controllers. Minimal APIs require an infrastructure effort for discovery, but offer more control. |
| **Supported Endpoint Type** | MVC Controllers. | `MapGet`, `MapPost`, etc., endpoints. | The choice of endpoint type in the slice dictates the discovery strategy. |
| **Initial Configuration Complexity (Discovery)** | Low if they are project references, as the build system and MVC handle it. | Low (extension methods) or Moderate (reflection), to potentially higher (source generators), as the discovery logic is built. | Minimal APIs require more initial infrastructure code for discovery in some cases. |
| **Perceived Endpoint Performance** | Full MVC pipeline. Could have more overhead. | Lighter design can lead to better performance, though not necessarily. | For high performance sensitivity, Minimal APIs may be preferable. |
| **Flexibility** | Less flexible (must be Controller classes). | Very flexible (delegates, methods in classes, etc.). | Minimal APIs offer more freedom, aligning with VSA's idea of adapting the implementation to the slice's need. |
| **Philosophical Alignment with VSA** | Moderate. | High (small, cohesive endpoints). | Minimal APIs fit more naturally with the spirit of VSA. |

**Why choose one or the other:**

  - **MVC Controllers with `ApplicationParts`:**

      - **Why:** If migrating existing MVC code, depending on complex MVC features (advanced filters, complex model binding, OData), or if the team is very familiar with MVC.
      - **How:** By leveraging the built-in discovery mechanism of ASP.NET Core.

  - **Minimal APIs with Custom Discovery:**

      - **Why:** For new projects seeking lightweightness, performance, and a purer alignment with VSA.
      - **How:** By implementing a discovery system (reflection or source generators) that adapts to the project's conventions.

  - **Coexistence:**

      - **Why:** To allow for gradual evolution or to use the best approach for different modules.
      - **How:** ASP.NET Core allows mapping both controllers and Minimal APIs in the same application.

The decision is based on the why of the project's needs (legacy, performance, feature complexity) and the how you want to manage the discovery infrastructure.

<div id="in-depth-analysis"\>

## IV. General Advantages and Disadvantages of Vertical Slice Architecture

<div id="detailed-advantages"\>

### Detailed Advantages (The Why Behind its Benefits)

  - **High Cohesion and Low Coupling:**
      - **Why:** Grouping all the code for a feature reduces dependencies between unrelated features.
      - **How:** Changes in one slice are less likely to impact other slices.
  - **Improved Maintainability and Testability:**
      - **Why:** Localized code is easier to understand and modify.
      - **How:** Tests focused on the behavior of the slice in isolation.
  - **Development Scalability and Team Productivity:**
      - **Why:** Fewer conflicts between developers working on different features.
      - **How:** New members can focus on one slice without understanding the entire system.
  - **Flexibility in Implementation per Slice:**
      - **Why:** Not all features have the same complexity or technical requirements.
      - **How:** Each slice can, theoretically, use the optimal tools or patterns for its specific need (e.g., EF Core for one slice, Dapper for another). This must be balanced with consistency.
  - **Clean Removal of Features:**
      - **Why:** If a feature becomes obsolete.
      - **How:** Deleting the slice's folder/project is safer due to low coupling.

<div id="disadvantages-and-common-challenges"\>

### Disadvantages and Common Challenges

  - **Potential Code Duplication:**
      - **Why:** The independence of slices can lead to repeated logic or DTOs.
      - **How to mitigate:** Extract truly common functionalities to a `SharedKernel` or shared utilities. Distinguish "bad" duplication from "acceptable" duplication that preserves autonomy.
  - **Management of Cross-Cutting Concerns:**
      - **Why:** Logging, authorization, validation, etc., must be applied consistently.
      - **How to manage:** Use ASP.NET Core middleware, action/endpoint filters, or the Decorator pattern implemented manually on feature handlers. These are .NET framework mechanisms.
  - **Maintaining Consistency Across Slices:**
      - **Why:** Too much flexibility in per-slice implementation can lead to an inconsistent codebase.
      - **How to manage:** Clear architectural guidelines, code reviews, and team discipline to maintain a reasonable level of consistency.
  - **Initial Learning Curve and Required Discipline:**
      - **Why:** VSA is not inherently "easier" if the principles of coupling, cohesion, and refactoring are not understood.
      - **How to manage:** Foster a deep understanding of these principles and the ability to refactor.
  - **Large Number of Classes/Files:**
      - **Why:** Fine granularity can lead to many small files.
      - **How to manage:** Good folder structure and naming conventions.

<div id="brief-mention-of-other-possible-alternatives"\>

## V. Other Possible Implementation Alternatives in VSA

There are variations in how details are implemented within VSA, using .NET capabilities:

<div id="internal-organization-of-slices"\>

### Internal Organization of Slices

  - **Single Files with Nested Classes:**
      - **Why:** For greater visual cohesion and simpler class names within the context of the file.
      - **How:** Group Request, Response, Handler, etc., of a slice into a single C\# file using nested classes.
  - **Feature Folders:**
      - **Why:** More traditional structure, clear separation of files.
      - **How:** Each component of the slice in its own file, grouped in a folder per feature.

<div id="direct-communication-between-slices"\>

### Direct Communication Between Slices (without an explicit mediator like MediatR or RouteDispatcher, etc.)

  - **Why:** For simple synchronous interactions within the same process, a mediator can be unnecessary overhead.
  - **How:** One feature invokes functionality from another through a well-defined interface (exposed by the invoked slice and registered in DI). This uses .NET's dependency injection.

<div id="using-source-generators-for-registrationoptimization"\>

### Using Source Generators or extension methods for Registration/Optimization

  - **Why:** To reduce boilerplate code in service or endpoint registration, and to improve startup performance and AOT compatibility by avoiding runtime reflection.
  - **How:** .NET Source Generators analyze code at compile time and can automatically generate the necessary code to, for example, register all feature handlers or Minimal API endpoints.

These alternatives focus on how to structure the code or how to perform certain tasks (like registration) using intrinsic .NET functionalities, without depending on external libraries. In fact, using code generators or reflection could be a lot of extra code if not used frequently, and perhaps, the extension methods I mentioned before are a more versatile solution.

<div id="conclusion-and-strategic-recommendations"\>

## VI. Conclusion and Strategic Recommendations: A Pragmatic Approach with .NET

Vertical Slice Architecture in .NET, implemented through projects separated by context, offers a pragmatic way to build modular and maintainable systems.

**Summary of Key Findings (Whys and Hows):**

  - VSA organizes code by vertical functionality (improving cohesion and maintainability, grouping everything for one feature).
  - Separation into projects by context (isolation and organization; class libraries by context) aligns with Modular Monoliths.
  - Exposing endpoints from separate projects is achieved with:
      - **MVC Controllers:** `ApplicationParts` (native MVC mechanism; `ApplicationPartManager` discovers controllers).
      - **Minimal APIs:** Custom discovery (no native mechanism for external assemblies; extension methods, reflection on interfaces/attributes, or Source Generators).
  - VSA has advantages in maintainability and flexibility (localization of change, adaptation per slice) but requires discipline (risk of inconsistency, duplication).

**Strategic Recommendations (Pragmatic Decisions):**

  - **Choosing the Endpoint Exposure Mechanism (The "How" based on the "Why"):**
      - If your slices use MVC Controllers (legacy, necessary MVC complexity), use `ApplicationParts` (configuration in `Program.cs`).
      - If your slices use Minimal APIs (lightweight, new developments), implement custom discovery with reflection or Source Generators (define conventions and scan/generate registration code).
  - **Evaluate Team Maturity and Discipline (The "Why" of the need for skill):** VSA provides flexibility; without a solid foundation in design and refactoring, it can lead to inconsistencies. How this freedom is managed is crucial.
  - **Design of the `SharedKernel` and Strategies for Cross-Cutting Concerns (The "How" of sharing and consistency):**
      - Avoid excessive duplication and apply global policies through a `SharedKernel` for truly common and stable code. Use .NET middleware, filters, and decorators for cross-cutting concerns.
  - **Consider VSA as an Enabler of Modular Monoliths (The "Why" of this structure):**
      - It offers a good balance between the simplicity of a monolith and modularity, without the initial complexity of microservices, by structuring the solution with independent context projects.

**Final Considerations:**
Vertical Slice Architecture, when approached with a clear understanding of its principles and using the capabilities of the .NET framework pragmatically, allows for the construction of robust and evolutionary systems. The choice between `ApplicationParts` for MVC controllers and custom discovery for Minimal APIs is a fundamental technical decision, guided by the why of each slice's needs and the how they are integrated into the main application.

Everything mentioned above was condensed (reasonably) on Github [Vertical Slices in .NET - Github](https://github.com/pablomederos/vetical-slices-dotnet)