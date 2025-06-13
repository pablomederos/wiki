---
title: Vertical Slices en .NET
description: Arquitectura de Software in Dotnet: Una introducción pragmática a Vertical Slices
published: true
date: 2025-06-13T19:55:25.775Z
tags: .net, asp.net core, arquitectura de software, vertical slice architecture, arquitectura .net, monolito modular, cqrs, diseño de apis, minimal apis, .net minimal apis, asp.net core mvc, applicationparts, inyección de dependencias .net, .net source generators, bounded context, shared kernel, reflection en .net, endpoints en .net, cómo implementar vertical slice en .net, ventajas de la arquitectura vertical slice, minimal apis vs mvc controllers en .net, descubrimiento de endpoints en asp.net core, arquitectura vertical slice con proyectos separados, organizar proyectos .net por features, usar applicationparts para descubrir controladores, registro de servicios con reflexión en .net
editor: markdown
dateCreated: 2025-06-10T20:57:34.537Z
---


# Vertical Slices en .NET

I. [Introducción a la Arquitectura de Vertical Slice en .NET](introduction)
- A. [Principios Fundamentales de VSA: El Porqué y el Cómo](#principios-fundamentales-de-vsa-el-porque-y-el-como)
- B. [VSA en el Ecosistema .NET: Mecanismos del Framework](#vsa-en-el-ecosistema-net-mecanismos-del-framework)
  
II. [Implementación de Vertical Slices en Proyectos Separados por Contexto: El Cómo y el Porqué de la Modularización](#implementacion-de-vertical-slices-en-proyectos-separados)
- A. [Visión General Conceptual: Estructurando "Contextos" como Proyectos Independientes](#vision-general-conceptual)
- B. [Consideraciones Clave para la Separación de Proyectos: El Cómo de la Integración](#consideraciones-clave-para-la-separacion-de-proyectos)
  
III. [Estrategias de Exposición de Endpoints para Slices Verticales en Proyectos Separados: Mecanismos de .NET](#estrategias-de-exposicion-de-endpoints)
- A. [Uso de ApplicationParts de ASP.NET Core (para Controladores MVC)](#uso-de-applicationparts-de-aspnet-core)
- B. [Aprovechamiento de Minimal APIs (con Descubrimiento Personalizado)](#aprovechamiento-de-minimal-apis)
- C. [ApplicationParts vs. Minimal APIs para Slices en Proyectos Separados](#analisis-comparativo)
  - C.1 [Ejemplo más directo usando solo métodos de extensión y Minimal APIs](#extension-methods)
  
IV. [Ventajas y Desventajas Generales de la Arquitectura Vertical Slice](#analisis-profundo)
- A. [Ventajas Detalladas (El Porqué de sus Beneficios)](#ventajas-detalladas)
- B. [Desventajas y Desafíos Comunes](#desventajas-y-desafios-comunes)
  
V. [Otras Posibles Alternativas de Implementación en VSA](#mencion-resumida-de-otras-posibles-alternativas)
- A. [Organización Interna de los Slices](#organizacion-interna-de-los-slices)
- B. [Comunicación Directa entre Slices (sin mediador explícito)](#comunicacion-directa-entre-slices)
- C. [Uso de Source Generators para Registro/Optimización](#uso-de-source-generators-para-registrooptimizacion)
  
VI. [Conclusión y Recomendaciones Estratégicas: Un Enfoque Pragmático con .NET](#conclusion-y-recomendaciones-estrategicas)


<br>

<div id="introduction"\>

## I. Introducción a la Arquitectura de Vertical Slice en .NET

La Arquitectura de Vertical Slice (VSA) ha ganado una tracción considerable en la comunidad de desarrollo de .NET como una alternativa a los enfoques arquitectónicos en capas más tradicionales. Su filosofía central se basa en organizar la lógica de la aplicación en torno a funcionalidades o características de negocio, denominadas "slices" (rebanadas), en lugar de agrupar el código por afinidad técnica en capas horizontales como presentación, lógica de negocio y acceso a datos. Cada slice vertical encapsula, idealmente, todos los aspectos necesarios para implementar una característica específica, desde la interfaz de usuario (si aplica) hasta la persistencia de datos, atravesando todas las preocupaciones técnicas relevantes para esa funcionalidad particular.
  
<p align="center">
  <img src="/vsa.drawio.png" width=400 />
</p>

<div id="principios-fundamentales-de-vsa-el-porque-y-el-como"\>

### Principios Fundamentales de VSA: El Porqué y el Cómo

La VSA se sustenta en varios principios clave que guían su implementación y buscan optimizar la estructura del código para la mantenibilidad y la evolución:

  - **Orientado a Casos de Uso (Use-case Driven):**

      - **Por qué:** El desarrollo tradicional centrado en capas puede dispersar la lógica de una única funcionalidad a través de múltiples componentes técnicos. Esto dificulta la comprensión y modificación de una característica completa. VSA busca alinear la estructura del código con la forma en que el negocio concibe y solicita funcionalidades.
      - **Cómo:** El sistema se organiza en torno a características o capacidades de negocio específicas. Cada "slice" representa un caso de uso. Esto facilita la adición, modificación o eliminación de funcionalidades de manera aislada, ya que el impacto se contiene principalmente dentro del slice.

  - **Disolución de Abstracciones (Melting Abstractions):**

      - **Por qué:** Las arquitecturas en capas a menudo imponen abstracciones rígidas (ej. "Controlador -\> Servicio -\> Repositorio") que no siempre aportan valor y pueden generar código repetitivo o innecesariamente complejo para funcionalidades simples.
      - **Cómo:** Se busca eliminar las barreras y abstracciones forzadas entre componentes técnicos dentro de un slice. Un slice contiene lo necesario para su funcionamiento, permitiendo un diseño más directo y adaptado a la necesidad específica de la característica. Esto no implica la ausencia total de abstracciones, sino una crítica a las "reglas rígidas sobre gestión de dependencias". Las abstracciones se utilizan donde aportan valor genuino, no como un dogma.

  - **Eje de Cambio (Axis Of Change):**

      - **Por qué:** Uno de los mayores desafíos en el mantenimiento de software es que un cambio en una funcionalidad requiere modificar código en múltiples lugares no relacionados directamente, aumentando el riesgo de errores. O que al transicionar desde una arquitectura monolítica a una distribuída, sea muy complejo encontrar todas las dependencias dispersas de una funcinalidad en cada capa.
      - **Cómo:** Los componentes de software que tienden a cambiar juntos deben residir cerca unos de otros en la base de código. Cuando se implementa o modifica una característica, la mayoría de los cambios se localizan dentro de su slice correspondiente. Si las modificaciones a una funcionalidad suelen requerir tocar código en varias capas horizontales (UI, lógica de negocio, datos), agrupar esas partes verticalmente reduce la dispersión del cambio. O, Si se requiere extraer una funcionalidad a un microservicio, simplemente se puede extraer un proyecto o un directorio completo, sin necesidad de analizar cada línea de código dentro de la solución.

El objetivo primordial de VSA es maximizar la cohesión dentro de cada slice (todos los elementos del slice están fuertemente relacionados) y minimizar el acoplamiento entre slices diferentes (los slices son lo más independientes posible).

La popularización de VSA en .NET podría atribuirse quizá, aunque no exclusivamente, a Jimmy Bogard (creador de AutoMapper, MediatR y Respawn). Su argumento es que las arquitecturas en capas tradicionales pueden ser demasiado genéricas y no óptimas para la mayoría de las solicitudes individuales de un sistema. Puedes leer más acerca de este tema en este enlace: [Vertical Slice Architecture](https://www.jimmybogard.com/vertical-slice-architecture/).
  

<div id="vsa-en-el-ecosistema-net-mecanismos-del-framework"\>

### VSA en el Ecosistema .NET: Mecanismos del Framework

En el contexto de proyectos .NET, la Arquitectura de Vertical Slice se apoya en características y patrones del propio framework:

  - **Minimal APIs y ASP.NET Core MVC:**

      - **Por qué:** Se necesitan puntos de entrada HTTP para exponer las funcionalidades de los slices (si se trata de un API Rest por ejemplo).
      - **Cómo:** VSA puede implementarse utilizando tanto Minimal APIs como los controladores tradicionales de ASP.NET Core MVC. Minimal APIs (.NET 6+) se alinean bien con la filosofía de VSA de reducir el código repetitivo y centrarse en el endpoint y su lógica. Permiten definir endpoints con menos ceremonia. Los controladores MVC siguen siendo una opción robusta, especialmente para escenarios con funcionalidades MVC más complejas.

  - **Inyección de Dependencias (DI):**

      - **Por qué:** Para lograr el bajo acoplamiento y la testeabilidad, los componentes (como los endpoints y los manejadores de lógica de negocio) no deben crear sus dependencias directamente.
      - **Cómo:** El contenedor de DI incorporado en ASP.NET Core se utiliza para registrar y resolver los servicios y manejadores que cada slice necesita. Los endpoints (controladores o Minimal APIs) reciben sus dependencias (manejadores de características, servicios de infraestructura específicos del slice) a través de la DI.

  - **Estructura de Proyectos:**

      - **Por qué:** Para una mejor organización y aislamiento, especialmente en aplicaciones grandes.
      - **Cómo:** Se pueden crear carpetas por característica dentro de un mismo proyecto, o, como se enfoca esta nota, separar los slices en proyectos de biblioteca de clases (.csproj) independientes, agrupados por contexto de negocio.

<div id="implementacion-de-vertical-slices-en-proyectos-separados"\>

## II. Implementación de Vertical Slices en Proyectos Separados por Contexto: El Cómo y el Porqué de la Modularización

Separar los slices en proyectos de biblioteca de clases independientes, agrupados por "contexto de negocio", es una estrategia para organizar aplicaciones VSA más grandes. La aplicación principal (API web ASP.NET Core) actúa como ensamblador.

<div id="vision-general-conceptual"\>

### Visión General Conceptual: Estructurando "Contextos" como Proyectos Independientes

**Por qué:**

  - **Aislamiento y Límites Claros:** Cada contexto de negocio tiene su propio proyecto, estableciendo límites de compilación y reduciendo el riesgo de acoplamiento no deseado entre contextos distintos. Esto es similar a los "Bounded Contexts" de Domain-Driven Design.
  - **Organización para Equipos:** Facilita que diferentes equipos trabajen en contextos distintos con menor interferencia.
  - **Potencial de Evolución:** Aunque se despliegue como un monolito, esta estructura modular puede facilitar la extracción de módulos a microservicios en el futuro si fuera necesario.

**Cómo:**
Una estructura típica:

  - `MainApiProject.csproj`: Proyecto ASP.NET Core.
  - `ContextA.Features.csproj`: Biblioteca de clases con slices para el Contexto A.
  - `ContextB.Features.csproj`: Biblioteca de clases con slices para el Contexto B.
  - `SharedKernel.csproj`: Código compartido (utilidades, interfaces transversales, DTOs comunes si son estrictamente necesarios y bien definidos).

La comunicación inter-contexto, si es necesaria, debe ser explícita, usualmente a través de interfaces definidas en un proyecto compartido o expuestas por el API pública de cada módulo de contexto. El desafío principal es cómo el `MainApiProject` descubre y registra los endpoints definidos en los proyectos de contexto.
Personalmente prefiero usar y abusar de métodos de extensión que luego pueda agregar casi de forma transparente a mi `MainApiProject`.

<div id="consideraciones-clave-para-la-separacion-de-proyectos"\>

### Consideraciones Clave para la Separación de Proyectos: El Cómo de la Integración

  - **Gestión de Dependencias:** El proyecto API principal referencia los proyectos de contexto.
  - **Descubrimiento de Features/Endpoints:**
      - **Por qué:** Los endpoints (Controladores MVC o Minimal APIs) definidos en los proyectos de contexto deben ser accesibles a través de HTTP. El proyecto principal necesita saber de ellos.
      - **Cómo:** Se explorarán `ApplicationParts` para MVC y Minimal APIs quizá con técnicas de reflexión, generadores de código, o simples métodos de extensión.
  - **Compartición de Código:**
      - **Por qué:** Evitar duplicación excesiva de código verdaderamente común.
      - **Cómo:** Usar un `SharedKernel` con precaución para no crear un "god object". Compartir solo lo que es estable y genuinamente reutilizable.
  - **Intereses Transversales (Cross-Cutting Concerns):**
      - **Por qué:** Funcionalidades como logging, autorización, validación deben aplicarse consistentemente.
      - **Cómo:** Utilizar middleware de ASP.NET Core, filtros de acción/endpoint, o decoradores implementados manualmente sobre los manejadores de características. Estos mecanismos son parte del marco .NET.
  - **Configuración y Arranque:**
      - **Por qué:** Los servicios y endpoints de cada contexto deben ser registrados en la aplicación principal.
      - **Cómo:** En `Program.cs`, se configura el registro de servicios y el mapeo de endpoints provenientes de los proyectos de contexto, ya sea directamente (poco recomendable) o usando métodos de extensión.

<div id="estrategias-de-exposicion-de-endpoints"\>

## III. Estrategias de Exposición de Endpoints para Slices Verticales en Proyectos Separados: Mecanismos de .NET

Cuando los slices residen en proyectos separados, el proyecto API principal necesita un mecanismo para descubrir y exponer sus endpoints HTTP.

<div id="uso-de-applicationparts-de-aspnet-core"\>

### Uso de ApplicationParts de ASP.NET Core (para Controladores MVC)

**Por qué existe `ApplicationParts`:** ASP.NET Core MVC necesita una forma de encontrar componentes como Controladores, Vistas, View Components, etc., que pueden estar en el ensamblado principal o en ensamblados referenciados (como los proyectos de contexto). `ApplicationParts` es la abstracción que permite esto.

**Cómo funciona:** El `ApplicationPartManager` rastrea las `ApplicationParts` (una `AssemblyPart` encapsula un ensamblado) y los `IFeatureProvider` (como `ControllerFeatureProvider`) para descubrir estos componentes. Por defecto, MVC examina las dependencias del proyecto principal y descubre controladores en ensamblados referenciados.

**Ventajas para VSA con Proyectos Separados (usando Controladores MVC):**

  - **Mecanismo Nativo:** Es la forma integrada de ASP.NET Core para descubrir controladores MVC.
  - **Descubrimiento Automático (con referencias de proyecto):** Si los proyectos de contexto son referenciados, sus controladores MVC suelen descubrirse automáticamente.
  - **Configuración Centralizada:** La personalización se hace en `Program.cs`.

**Desventajas y Limitaciones:**

  - **Acoplado a MVC Tradicional:** No aplica a Minimal APIs (Aunque podría no ser un requisito).
  - **Overhead de MVC:** Implica el framework MVC completo. Es decir, cuando se elige usar un Controlador MVC para un endpoint, no solo se ejecuta el método de acción, sino que además se activa toda la maquinaria y el ciclo de vida que el framework de ASP.NET Core MVC utiliza para procesar una solicitud.

**Ejemplo de Código Minimalista (Ilustrativo):**
  
```csharp
//FeatureAController.cs en un proyecto a parte
using Microsoft.AspNetCore.Mvc;

namespace ContextA.Features.Controllers;

[ApiController]
[Route("[controller]")]
public class FeatureAController: ControllerBase
{
    public IActionResult Index()
    {
        return Ok("Hola mundo desde FeatureA!");
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


o más configurable:
  
  
```csharp
using Microsoft.AspNetCore.Mvc.ApplicationParts;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);
IServiceCollection services = builder.Services;

services.AddControllers()
    .ConfigureApplicationPartManager(apm =>
    {
        // Ejemplo de cómo se podría añadir un ensamblado cargado dinámicamente:
        // var pluginAssembly = Assembly.LoadFrom("ruta/a/ContextA.Features.dll");
        // apm.ApplicationParts.Add(new AssemblyPart(pluginAssembly));

        // Ejemplo de cómo se podría remover un ensamblado si fuera necesario:
        // var assemblyToExclude = apm.ApplicationParts
        //                          .FirstOrDefault(part => part.Name == "EnsambladoAExcluir");
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

O mediante métodos de extensión:
  
```csharp
// FeatureAExtensions.cs
// Suelo colocar uno en cada proyecto para que cada funcionalidad
// sea responsable de registrarse a sí misma
  
using Microsoft.Extensions.DependencyInjection;

namespace ContextA.Features.Extensions;

public static class FeatureAExtensions
{
    public static IMvcBuilder AddFeatureA(this IMvcBuilder builder)
    {
  			// Descubriá todos los controladores que contiene
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

// Requerido para FeatureA
services
    .AddControllers()
    .AddFeatureA();

// Opcional para FeatureA
services
    .AddFeatureAServices();

WebApplication app = builder.Build();

app.MapControllers();

app.Run();

```
  

Este ejemplo se basa en los conceptos descritos anteriormente. El `ApplicationPartManager` permite añadir `AssemblyPart` para ensamblados que no son referencias directas, lo cual es clave para un sistema de plugins o para cargar módulos de características de forma más dinámica.

<div id="aprovechamiento-de-minimal-apis"\>

### Aprovechamiento de Minimal APIs (con Descubrimiento Personalizado)

**Por qué Minimal APIs:** Ofrecen una sintaxis concisa para definir endpoints HTTP, alineándose con la idea de VSA de reducir el boilerplate y mantener la lógica del endpoint cohesiva. Aunque no estoy completamente de acuerdo con lo primero, sí creo que esto último es un beneficio indiscutible.

**Por qué se necesita descubrimiento personalizado:** ASP.NET Core no tiene un mecanismo automático como `ApplicationParts` para descubrir Minimal APIs definidas en ensamblados externos. Aunque podemos valernos de métodos de extensión, u otros mecanismos antes mencionados. Qué tan elaborado, dependerá de las necesidades de cada proyecto.

**Cómo implementar el descubrimiento personalizado:**

  - **Convención y Reflexión:**

      - **Cómo:** Definir una interfaz marcadora (ej. `IEndpointDefinition`) en un proyecto compartido. En cada proyecto de contexto, las clases que definen Minimal APIs implementan esta interfaz. En el `Program.cs` del proyecto principal, usar reflexión para escanear los ensamblados de los contextos, encontrar tipos que implementen `IEndpointDefinition`, instanciarlos y llamar a un método convenido (ej. `MapEndpoints(IEndpointRouteBuilder app)`) para registrar las rutas.
      - **Por qué:** Permite un descubrimiento dinámico sin acoplar el proyecto principal a cada endpoint individual. La reflexión es una capacidad nativa de .NET.

  - **Source Generators (Generadores de Código Fuente):**

      - **Cómo:** En lugar de reflexión en tiempo de ejecución, un generador de código fuente puede analizar los proyectos de contexto en tiempo de compilación, identificar los endpoints (basado en atributos o convenciones) y generar el código de registro directamente en el proyecto principal. Por ejemplo, creando métodos de extensión a la medida.
      - **Por qué:** Mejora el rendimiento en el arranque al evitar la reflexión y puede ser más compatible con escenarios de compilación AOT (Ahead-Of-Time).

**Ventajas para VSA con Proyectos Separados (usando Minimal APIs):**

  - **Ligereza y Rendimiento Potencial:** Menos sobrecarga que MVC.
  - **Alineación Filosófica con VSA:** Fomenta endpoints pequeños y cohesivos.
  - **Flexibilidad en el Descubrimiento:** El mecanismo se adapta a las necesidades.

**Desventajas y Limitaciones:**

  - **Esfuerzo de Implementación para Descubrimiento:** Requiere código adicional (reflexión, source generators, o al menos métodos de extensión considerando la mantenibilidad) para el descubrimiento.
  - **Madurez para Características Avanzadas:** Algunas funcionalidades complejas de MVC pueden requerir más trabajo para replicar en Minimal APIs, aunque esto está mejorando continuamente.

**Ejemplo de Código Minimalista (Descubrimiento de Minimal APIs por Reflexión):**

En `SharedKernel.csproj` (o similar):

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
using Microsoft.Extensions.DependencyInjection;
using System.Reflection;

namespace SharedKernel.Api

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

En `ContextB.Features.csproj`:

```csharp
// ContextB.Features/FeatureB.cs
  
namespace ContextB.Features.Api;

public sealed class FeatureB : IEndpointDefinition
{
    // Solo se requiere el constructor por defecto
    
    public void MapEndpoints(
        IEndpointRouteBuilder app
    )
    {
        app.MapGet("/FeatureB", 
            (SomeService  someService) => someService.GetHi()
        );
    }
}
```

En `MainApiProject/Program.cs`:

```csharp
// MainApiProject/Program.cs
  
using ContextB.Features.Extensions;
using SharedKernel.Api;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);
IServiceCollection services = builder.Services;


// Opcional si hay que registrar servicios
services
    .AddFeatureBServices();

WebApplication app = builder.Build();

app.MapAllEndpoints(
    typeof(ContextB.Features.Api.FeatureB).Assembly
);

app.Run();
```

Este ejemplo ilustra el cómo (reflexión para encontrar implementaciones de `IEndpointDefinition`) y el porqué (necesidad de un mecanismo de registro explícito para Minimal APIs en ensamblados separados).
 
  
<div id="extension-methods"\>
  
#### Ejemplo más directo usando solo métodos de extensión y Minimal APIs
  
En `ContextC.Features.csproj`:
  
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

    // Cada método HTTP podría tener su propia clase para mayor control
    private static IEndpointRouteBuilder AddGet(this IEndpointRouteBuilder app)
    {
        app.MapGet("/FeatureC", 
            (SomeService  someService) => someService.GetHi()
        );
        
        return app;
    }
}
```

En `MainApiProject/Program.cs`:

```csharp
using ContextC.Features.Api;
using ContextC.Features.Extensions;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);
IServiceCollection services = builder.Services;

// Opcional
services
    .AddFeatureCServices();

WebApplication app = builder.Build();

app.MapFeatureCEndpoints();

app.Run();
```
  
Este enfoque es más directo y también más todoterreno, ya que no usa Reflexión y no depende de un proyecto externo para el descubrimiento de los endpoints. El rendimiento podría ser apenas ligeramente mayor durante arranque de la aplicación, pero no habría diferencias durante la ejecución regular del proceso. También se evita la sobreingeniería en la mayoría de los casos.
  

<div id="analisis-comparativo"\>

### ApplicationParts vs. Minimal APIs para Slices en Proyectos Separados

| Característica/Aspecto | ApplicationParts (con Controladores MVC) | Minimal APIs (con descubrimiento personalizado vía reflexión/source generators/métodos de extensión) | Por qué y Cómo Impacta en VSA con Proyectos Separados |
| -- | -- | -- | -- |
| **Mecanismo de Descubrimiento** | **Cómo:** Integrado (`ApplicationPartManager` escanea por tipos `ControllerBase`). **Por qué:** MVC tiene un modelo rico de características que necesitan ser descubiertas. | **Cómo:** Implementación manual (reflexión sobre interfaces/atributos o source generators) **Por qué:** Minimal APIs es "mínimo", no incluye descubrimiento complejo de ensamblados externos por defecto. | `ApplicationParts` es "listo para usar" para controladores. Minimal APIs requiere un esfuerzo de infraestructura para el descubrimiento, pero ofrece más control|
| **Tipo de Endpoint Soportado** | Controladores MVC. | Endpoints `MapGet`, `MapPost`, etc. | La elección del tipo de endpoint en el slice dicta la estrategia de descubrimiento. |
 **Complejidad de Configuración Inicial (Descubrimiento)** | Baja si son referencias de proyecto. Ya que el sistema de build y MVC lo manejan. | Baja (métodos de extensión) o Moderada (reflexión), a potencialmente más alta source generators), ya que se construye la lógica de descubrimiento. | Minimal APIs requiere más código de infraestructura inicial para el descubrimiento en algunos casos. |
| **Rendimiento Percibido del Endpoint** | Pipeline MVC completo. Podría tener más sobrecarga. | Diseño más ligero puede llevar a mejor rendimiento, aunque no necesariamente. | Para alta sensibilidad al rendimiento, Minimal APIs puede ser preferible. |
| **Flexibilidad** | Menos flexible (deben ser clases Controlador). | Muy flexible (delegados, métodos en clases, etc.). | Minimal APIs ofrece más libertad, alineándose con la idea de VSA de adaptar la implementación a la necesidad del slice. |
| **Alineación Filosófica con VSA** | Moderada. | Alta (endpoints pequeños, cohesivos). | Minimal APIs encaja más naturalmente con el espíritu de VSA. |

**Por qué elegir uno u otro:**

  - **Controladores MVC con `ApplicationParts`:**

      - **Por qué:** Si se migra código MVC existente, se depende de características complejas de MVC (filtros avanzados, model binding complejo, OData), o el equipo está muy familiarizado con MVC.
      - **Cómo:** Aprovechando el mecanismo de descubrimiento integrado de ASP.NET Core.

  - **Minimal APIs con Descubrimiento Personalizado:**

      - **Por qué:** Para nuevos proyectos buscando ligereza, rendimiento, y una alineación más pura con VSA.
      - **Cómo:** Implementando un sistema de descubrimiento (reflexión o source generators) que se adapte a las convenciones del proyecto.

  - **Coexistencia:**

      - **Por qué:** Para permitir una evolución gradual o usar el mejor enfoque para diferentes módulos.
      - **Cómo:** ASP.NET Core permite mapear tanto controladores como Minimal APIs en la misma aplicación.

La decisión se basa en el porqué de las necesidades del proyecto (legado, rendimiento, complejidad de características) y el cómo se desea gestionar la infraestructura de descubrimiento.

<div id="analisis-profundo"\>

## IV. Ventajas y Desventajas Generales de la Arquitectura Vertical Slice

<div id="ventajas-detalladas"\>

### Ventajas Detalladas (El Porqué de sus Beneficios)

  - **Alta Cohesión y Bajo Acoplamiento:**
      - **Por qué:** Agrupar todo el código de una característica reduce las dependencias entre características no relacionadas.
      - **Cómo:** Cambios en un slice tienen menos probabilidad de impactar otros slices.
  - **Mantenibilidad y Testeabilidad Mejoradas:**
      - **Por qué:** Código localizado es más fácil de entender y modificar.
      - **Cómo:** Pruebas enfocadas en el comportamiento del slice de forma aislada.
  - **Escalabilidad del Desarrollo y Productividad del Equipo:**
      - **Por qué:** Menos conflictos entre desarrolladores trabajando en features distintas.
      - **Cómo:** Nuevos miembros pueden enfocarse en un slice sin entender todo el sistema.
  - **Flexibilidad en la Implementación por Slice:**
      - **Por qué:** No todas las características tienen la misma complejidad o requisitos técnicos.
      - **Cómo:** Cada slice puede, teóricamente, usar las herramientas o patrones óptimos para su necesidad específica (ej. EF Core para un slice, Dapper para otro). Se debe balancear con la consistencia.
  - **Eliminación Limpia de Características:**
      - **Por qué:** Si una característica se vuelve obsoleta.
      - **Cómo:** Borrar la carpeta/proyecto del slice es más seguro debido al bajo acoplamiento.

<div id="desventajas-y-desafios-comunes"\>

### Desventajas y Desafíos Comunes

  - **Potencial Duplicación de Código:**
      - **Por qué:** La independencia de los slices puede llevar a repetir lógica o DTOs.
      - **Cómo mitigar:** Extraer funcionalidades verdaderamente comunes a un `SharedKernel` o utilidades compartidas. Distinguir duplicación "mala" de la "aceptable" que preserva autonomía.
  - **Gestión de Intereses Transversales:**
      - **Por qué:** Logging, autorización, validación, etc., deben aplicarse consistentemente.
      - **Cómo gestionar:** Usar middleware de ASP.NET Core, filtros de acción/endpoint, o el patrón Decorator implementado manualmente sobre los manejadores de características. Estos son mecanismos del framework .NET.
  - **Mantenimiento de la Consistencia entre Slices:**
      - **Por qué:** Demasiada flexibilidad en la implementación por slice puede llevar a un código base inconsistente.
      - **Cómo gestionar:** Guías arquitectónicas claras, revisiones de código y disciplina de equipo para mantener un nivel de consistencia razonable.
  - **Curva de Aprendizaje Inicial y Disciplina Requerida:**
      - **Por qué:** VSA no es inherentemente "más fácil" si no se entienden los principios de acoplamiento, cohesión y refactoring.
      - **Cómo gestionar:** Fomentar la comprensión profunda de estos principios y la habilidad para refactorizar.
  - **Gran Número de Clases/Archivos:**
      - **Por qué:** La granularidad fina puede llevar a muchos archivos pequeños.
      - **Cómo gestionar:** Buena estructura de carpetas y convenciones de nombrado.

<div id="mencion-resumida-de-otras-posibles-alternativas"\>

## V. Otras Posibles Alternativas de Implementación en VSA

Existen variaciones en cómo se implementan los detalles dentro de VSA, utilizando capacidades de .NET:

<div id="organizacion-interna-de-los-slices"\>

### Organización Interna de los Slices

  - **Archivos Únicos con Clases Anidadas:**
      - **Por qué:** Para mayor cohesión visual y nombres de clase más simples dentro del contexto del archivo.
      - **Cómo:** Agrupar Request, Response, Handler, etc., de un slice en un único archivo C\# usando clases anidadas.
  - **Carpetas por Característica (Feature Folders):**
      - **Por qué:** Estructura más tradicional, clara separación de archivos.
      - **Cómo:** Cada componente del slice en su propio archivo, agrupados en una carpeta por característica.

<div id="comunicacion-directa-entre-slices"\>

### Comunicación Directa entre Slices (sin mediador explícito como MediaTr o RouteDispatcher, etc.)

  - **Por qué:** Para interacciones síncronas simples dentro del mismo proceso, un mediador puede ser una sobrecarga innecesaria.
  - **Cómo:** Una característica invoca funcionalidad de otra a través de una interfaz bien definida (expuesta por el slice invocado y registrada en DI). Esto utiliza la inyección de dependencias de .NET.

<div id="uso-de-source-generators-para-registrooptimizacion"\>

### Uso de Source Generators o métodos de extensión para Registro/Optimización

  - **Por qué:** Para reducir código repetitivo (boilerplate) en el registro de servicios o endpoints, y para mejorar el rendimiento en el arranque y la compatibilidad AOT al evitar la reflexión en tiempo de ejecución.
  - **Cómo:** Los Source Generators de .NET analizan el código en tiempo de compilación y pueden generar automáticamente el código necesario para, por ejemplo, registrar todos los manejadores de características o los endpoints de Minimal APIs.

Estas alternativas se centran en cómo estructurar el código o cómo realizar ciertas tareas (como el registro) utilizando funcionalidades intrínsecas de .NET, sin depender de bibliotecas externas. De hecho, usar generadores de código o reflexión podría ser mucho código extra si no se usará frecuentemente, y quizá, lol métodos de extensión que mencioné antes, sean una solución más polivalente.

<div id="conclusion-y-recomendaciones-estrategicas"\>

## VI. Conclusión y Recomendaciones Estratégicas: Un Enfoque Pragmático con .NET

La Arquitectura de Vertical Slice en .NET, implementada mediante proyectos separados por contexto, ofrece una vía pragmática para construir sistemas modulares y mantenibles.

**Resumen de Hallazgos Clave (Porqués y Cómos):**

  - VSA organiza el código por funcionalidad vertical (mejorar cohesión y mantenibilidad, agrupando todo lo de una feature).
  - La separación en proyectos por contexto (aislamiento y organización; bibliotecas de clases por contexto) se alinea con Monolitos Modulares.
  - La exposición de endpoints desde proyectos separados se logra con:
      - **Controladores MVC:** `ApplicationParts` (mecanismo nativo de MVC; `ApplicationPartManager` descubre controladores).
      - **Minimal APIs:** Descubrimiento personalizado (no hay mecanismo nativo para ensamblados externos; métodos de extensión, reflexión sobre interfaces/atributos o Source Generators).
  - VSA tiene ventajas en mantenibilidad y flexibilidad (localización del cambio, adaptación por slice) pero requiere disciplina (riesgo de inconsistencia, duplicación).

**Recomendaciones Estratégicas (Decisiones Pragmáticas):**

  - **Elección del Mecanismo de Exposición de Endpoints (El "Cómo" basado en el "Porqué"):**
      - Si sus slices usan Controladores MVC (legado, complejidad MVC necesaria), use `ApplicationParts` (configuración en `Program.cs`).
      - Si sus slices usan Minimal APIs (ligereza, nuevos desarrollos), implemente un descubrimiento personalizado con reflexión o Source Generators (definir convenciones y escanear/generar código de registro).
  - **Evaluar la Madurez y Disciplina del Equipo (El "Porqué" de la necesidad de habilidad):** VSA otorga flexibilidad; sin una base sólida en diseño y refactoring, puede llevar a inconsistencias. El cómo se gestiona esta libertad es crucial.
  - **Diseño del `SharedKernel` y Estrategias para Intereses Transversales (El "Cómo" de la compartición y la consistencia):**
      - Evitar duplicación excesiva y aplicar políticas globales, mediante un "`SharedKernel`" para código verdaderamente común y estable. Middleware, filtros y decoradores de .NET para intereses transversales.
  - **Considerar VSA como un Habilitador de Monolitos Modulares (El "Porqué" de esta estructura):**
      - Ofrece un buen equilibrio entre simplicidad de monolito y modularidad, sin la complejidad inicial de microservicios, estructurando la solución con proyectos de contexto independientes.

**Consideraciones Finales:**
La Arquitectura de Vertical Slice, cuando se aborda con un entendimiento claro de sus principios y se utilizan las capacidades del framework .NET de manera pragmática, permite construir sistemas robustos y evolutivos. La elección entre `ApplicationParts` para controladores MVC y un descubrimiento personalizado para Minimal APIs es una decisión técnica fundamental, guiada por el porqué de las necesidades de cada slice y el cómo se integran estos en la aplicación principal.
  
Todo lo mencionado anteriormente se condensó (razonablemente) en Github [Vertical Slices en .NET - Github](https://github.com/pablomederos/vetical-slices-dotnet)