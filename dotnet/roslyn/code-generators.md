---
title: Metaprogramación con Generadores de código
description: Guia exaustiva sobre la generación de código usando las apis del compilador Roslyn
published: true
date: 2025-07-02T19:51:17.422Z
tags: roslyn, roslyn api, análisis de código, source generators, análisis estático, syntax tree, code analysis, árbol de sintaxis, api de compilador roslyn, .net source generators, code generators, generadores de código
editor: markdown
dateCreated: 2025-06-17T12:46:28.466Z
---

# Generadores de código con Roslyn

I. [Generación incremental: Fundamento y aplicación](#generacion-incremental-fundamento-y-aplicacion)
  - A. [Ventajas fundamentales de la generación de código en tiempo de compilación](#ventajas-fundamentales)
  - B. [Casos de uso en el ecosistema .NET](#casos-de-uso)
  - C. [Consideraciones de portabilidad](#consideraciones-de-portabilidad)
  - D. [Evolución de `ISourceGenerator` hacia `IIncrementalGenerator`](#evolucion-isourcegenerator)
  - E. [Elementos de un Generador de Código](#elementos-generador)
  - F. [Estrategias para Identificar los Objetivos de Generación](#estrategias-identificacion)
  
II. [Implementación práctica](#implementacion-practica)
III. [Testeando el generador de código](#testeando-generador)
IV. [El rendimiento que ofrece la caché](#rendimiento-cache)
  - A. [El Motor de Caché: Memoización en el Pipeline](#motor-cache)
  - B. [`ISymbol`: Su efecto en el Rendimiento](#isymbol-rendimiento)
  - C. [Mejor Práctica: El Patrón del DTO Equatable](#patron-dto-equatable)
  - D. [Optimizar la Estructura del Pipeline](#optimizar-pipeline)
  - E. [Tabla: Mejores Prácticas de Caché para Generadores Incrementales](#tabla-mejores-practicas)
  
V. [Conclusión y Recomendaciones Finales](#conclusion-recomendaciones)

Metaprogramación es la forma en que un programa de tratar a otros programas (o a sí mismo) como datos, como veremos en los siguientes párrafos. Esto ha abierto las puertas al desarrollo de los frameworks a lo largo de los años y les ha brindado la flexibilidad y dinámica que de otro modo habría sido considerablemente difícil. Por suerte, .NET nos brinda varias soluciones para manipular y extender nuestras aplicaciones, como lo son la reflexión ([runtime reflection](https://learn.microsoft.com/es-es/dotnet/fundamentals/reflection/reflection)), y las plantillas T4 ([T4 templates](https://learn.microsoft.com/en-us/visualstudio/modeling/code-generation-and-t4-text-templates?view=vs-2022)). Pero, ambas técnicas (especialmente la reflexión) presentan problemas de rendimiento durante el arranque y la ejecución de la aplicación, ya que en el caso de la reflexión, el framework debe analizar el código durante el tiempo de ejecución, resultando en un costo fijo extra de tiempo que no es posible optimizar (o al menos no al nivel del código compilado). Las plantillas T4 son un poco más flexibles en este sentido, pero todo dependerá del caso de uso.

Gracias a la llegada del compilador [`Roslyn`](https://github.com/dotnet/roslyn), se pasó de trabajar en una "caja negra" a hacerlo sobre una plataforma abierta con apis para análizar y generar código. Es ahí donde surgen los **Source Generators**. Básicamente un componente que analiza el código en tiempo de compilación (prácticamente cada vez que se agrega o remueve texto del código fuente) para producir nuevos archivos fuente que se compilan con el resto del código.

La idea de este artículo, es explicar qué es un generador de código incremental, cómo mejora el rendimiento de la aplicación y la relación entre el programador y su código. Si bien, ya no es algo nuevo, quiero presentar al ahora estándar de metaprogramación en tiempo de compilación de C#, para el desarrollo de bibliotecas modernas y de alto rendimiento.


<div id="generacion-incremental-fundamento-y-aplicacion">

## I. Generación incremental: Fundamento y aplicación


<br>

<div id="ventajas-fundamentales">

### A. Ventajas fundamentales de la generación  de código en tiempo de compilación


<br>

1.  **Mejora del rendimiento**
Como se mencioné antes, en lugar de realizar un análisis durante el runtime (tiempo de ejecución), se realiza en tiempo de compilación, mejorando el arranque de las aplicaciones, y la respuesta general durante toda la ejecución de un proceso. Esto es una mejora sustancial respecto de lo que se podía hacer hasta ahora
Un ejemplo de una implementación que ofrece los beneficios que mencioné, es el atributo [`GeneratedRegexAttribute`](https://learn.microsoft.com/es-es/dotnet/api/system.text.regularexpressions.generatedregexattribute?view=net-7.0), introducido en **.NET 7**. Se utiliza para evitar la compilación de una expresión regular en runtime, generando código durante la compilación, optimizado, y que evalúa las coinidencias. Esto es claramente una mejora importante en el rendimiento. Otro ejemplo podría ser el atributo [`LibraryImport`](https://www.google.com/search?q=%5Bhttps://learn.microsoft.com/en-us/dotnet/standard/native-interop/pinvoke-source-generation%5D\(https://learn.microsoft.com/en-us/dotnet/standard/native-interop/pinvoke-source-generation\)) (una de las herramientas que más me gusta de C# es [PInvoke](https://www.pinvoke.net/)), que viene a ser un sustituto a `DllImport`, así como también, son ejemplo las técnicas avanzadas que utiliza actualmente Blazor (otra maravilla en .NET) para convertir los templates razor a clases generadas, que se especializan en la generación de documentos HTML.
      
2.  **Eliminación de código repetitivo (Boilerplate)**
Otro de los beneficios es ahorrarnos la escritura de código repetitivo y propenso a errores, como lo es la creación de DTOs, mappers, o incluso DAOs y funciones de acceso a bases de datos o recursos de red.
      
3.  **Modelos de despliegue modernos**
Posiblemente una de las ventajas más importantes (al menos para este servidor), es la compatibilidad con tecnologías de optimización modernas como pueden ser la compilación **AOT** ([Ahead-of-Time](https://learn.microsoft.com/en-us/dotnet/core/deploying/native-aot/?tabs=windows%2Cnet8)), y el **Trimming** ([Recorte de ensamblados](https://learn.microsoft.com/en-us/dotnet/core/deploying/trimming/trim-self-contained)). Estas tecnologías son extremadamente positivas en entornos en la nube, móviles, o casos de uso que requieren alta eficiencia. En estos casos la compatibilidad con reflexión es inexistente o muy pobre, posiblemente el rendimiento es primordial, y ahí mismo la generación de código permite obtener todo el código necesario durante la compilación. Esto se conviernte de una simple optimización a un pilar de diseño arquitectónico en la estrategia de **.NET** para el futuro.
      

<div id="casos-de-uso">

### B. Casos de uso en el ecosistema .NET


Al tratar con generadores de código, no se trata de algo aislado o para algunos pocos, sino que actualmente están íntimamente integrados en la plataforma **.NET**.

1.  **Serializador `System.Text.Json`**
El serializador de **JSON** integrado en .NET es un ejemplo impecable de caso de uso. Usando el atributo [`JsonSerializableAttribute`](https://learn.microsoft.com/es-es/dotnet/api/system.text.json.serialization.jsonserializableattribute?view=net-8.0) en una clase parcial que extienda de `JsonSerializerContext`, es posible activar un generador de código que analiza nuestras clases y genera lógica de serialización y deserialización óptima durante la compilación. Esto tiene como resultado una mejora del rendimiento de hasta un 40% gracias a evitar el uso de la reflexión. [Me remito a estos tests](https://okyrylchuk.dev/blog/intro-to-serialization-with-source-generation-in-system-text-json/).

**El generador utiliza dos modos de operación:**
  - **Modo basado en metadatos**: Recolecta previamente los metadatos necesarios de los tipos para acelerar la serialización y deserialización.
  - **Modo de optimización de serialización**: Genera el código utilizando `Utf8JsonWriter` directamente, el mayor rendimiento de serialización, pero es más restrictivo y no soporta todas las opciones de personalización.
> Más detalles en [Microsoft Learn: serialization/system text json/source generation](https://learn.microsoft.com/en-us/dotnet/standard/serialization/system-text-json/source-generation)
  
2. **ASP.NET Core y Native AOT**
Otro caso interesante puede ser el de ASP.NET Core que utiliza el generador incorporado `RequestDelegateGenerator`. Esto hace que las Minimal APIs sean compatibles con **Native AOT**. Para esto se hace uso de los `interceptors`, que se tratarán a detalle en otro artículo (cuando reúna suficiente experiencia, ya que es aún preliminar y no he ahondado suficiente en el tema). Pero básicamente, intercepta las llamadas a `app.MapGet()` que normalmente dependerían de reflexión, reemplazándolas por lógica precompilada. Esto además de maximizar el rendimiento, aumenta también la portabilidad del código.
  
> Más detalles en: [Convierta los métodos de mapa en delegados de solicitudes con el generador de delegados de solicitudes de ASP.NET Core](https://learn.microsoft.com/es-es/aspnet/core/fundamentals/aot/request-delegate-generator/rdg?view=aspnetcore-8.0)
  
3. **Inyección de dependencias**
Muchos contenedores de Inyección de Dependencias de alto rendimiento ([Pure.DI](https://github.com/DevTeam/Pure.DI), [Injectio](https://github.com/loresoft/Injectio), [Jab](https://github.com/pakrym/jab), [StrongInject](https://github.com/YairHalberstadt/stronginject) [*algunos más activos que otros*]) implemenan el uso de generadores de código, generando el grafo de dependencias durante la compilación, detectando en esta misma fase qué dependencias que aún no fueron implementadas o están incompletas. Esto reduce la probabilidad de recibir excepciones en tiempo de ejecución, y sin mencionar la mejora en el rendimiento.
  

<div id="consideraciones-de-portabilidad">

### C. Consideraciones de portabilidad


En cuanto a desarrollar un generador de código, hay que tener en cuenta el entorno en el que se va a ejecutar.

1.  **Framework de destino (Target Framework)**
Es importante que el proyecto del generador tenga como framework de destino `netstandard2.0` para maximizar la compatibilidad con diferentes versiones de **Visual Studio**, **MSBuild**, el **SDK de .NET** e incluso algunos otros IDEs.
      
2.  **IDE vs. Compilación en Línea de Comandos**
El pipeline incremental, así como el sistema de caché (que se tratará más adelante en este artículo), se benefician mucho del IDE (**Visual Studio**, **Rider**, etc.), ofreciendo una retroalimentación inmediata al desarrollador y mejorando la experiencia de desarrollo. En caso de usarse la línea de comandos, este proceso de compilación no será automático y probablemente requiera agregar algún script que mejore la experiencia (realemente hará falta). Editores como **Visual Studio Code** y derivados podrían contar con soporte integrado mediante las extensiones oficiales de **.NET** y **C\#** ([C\# Dev Kit](https://marketplace.visualstudio.com/items?itemName=ms-dotnettools.csdevkit) u otras), pero sin estas extensiones, hay que tener en cuenta que el código no se irá generando frecuentemente, o al mínimo cambio, sino hasta que se produzca una compilación.
      
3.  **Entornos multiplataforma**
El desarrollo en **Unity** u otras plataformas seguramente puede requerir alguna configuración adicional para que se reconozcan los generadores como un componente de compilación. Cada cual lo tendrá seguramente documentado para cada caso puntual, así que no voy a ahondar en el tema, pero lo menciono para no dejarlo como algo arbitrario.
      

<div id="evolucion-isourcegenerator">

### D. Evolución de `ISourceGenerator` hacia `IIncrementalGenerator`


En pocas palabras, el uso de la interfaz `ISourceGenerator` no es una opción en absoluto. `IIncrementalGenerator` es la única opción, debido a que la anterior se marcó como obsoleta. Pero, debo mencionarla porque aún hay mucha documentación, y es frecuente encontrar cursos desactualizados o videos en YouTube algo antiguos que se centran en el uso de `ISourceGenerator`.

1.  **Comparación "arquitectónica": Imperativo vs Declarativo**

  A continuación paso a detallar las grandes diferencias entre ambas interfaces:
  
  - `ISourceGenerator`: Expone dos métodos: `Initialize` y `Execute`, junto a una implementación de `ISyntaxReceiver` o `ISyntaxContextReceiver`. Por medio de `ISyntaxReceiver` se realiza un recorrido por todos los árboles de sintaxis en una compilación del modo imperativo, para recopilar datos de los nodos, y posteriormente invoca al método `Execute`, que recibe la compilación completa y el "receptor" poblado para realizar la generación. Este es un modelo imperativo, y basado en eventos.
  - `IIncrementalGenerator`: Solo contiene el método `Initialize`, dentro del que el desarrollador escribe de forma declarativa un flujo de transformaciones, en una sitaxis similar a LINQ. Este flujo describe como se trasladan los datos desde las fuentes (código C Sharp u otros archivos) hasta el código generado.
      
2.  **Rendimiento inferior de `ISourceGenerator`**
El problema de rendimiento tiene que ver con que cada vez que se pulsa una tecla y se realiza un cambio en el código, se llama al método `Execute` de `ISourceGenerator`, lo que obliga a la reevaluación de la lógica completa, ralentizando en casi todos los casos al IDE. `IIncrementalGenerator` resuleve este problema, y permite a **Roslyn** usar **Memoization** de cada etapa, para aumentar la eficiencia y solo requiere ejecutarse para cambios en la entrada de datos que invaliden el caché realizado previamente. Además, `IIncrementalGenerator` separa la etapa inicial que realiza una comprobación sintáctica, de la más costosa que es la transformación. Esta última etapa implica análisis semántico, y ahí es donde reducir el foco del análisis al mímino ofrece mayores beneficios. Este punto hace posible que el compilador pueda ejecutar el generador en muchos nodos, pero solo invocar la transformación en aquellos que se filtraron en la primera etapa.
      

<div id="elementos-generador">

### E. Elementos de un Generador de Código


1.  **El Punto de Entrada**
El único punto de entrada de un Generador de Codigo es el método `Initialize`. El parámtro `IncrementalGeneratorInitializationContext` ofrece acceso a los diferentes proveedores de datos que son la base de todo generador de Roslyn.
Los proveedores disponibles entre otros son:
  - `SyntaxProvider`: Permite la consulta de árboles de sintaxis
  - `CompilationProvider`: Permite acceder a la compilación completa, incluyendo información semántica.
  - `AdditionalTextsProvider`: Para leer otros archivos en el proyecto (json, txt, xml, etc.).

2.  **Identificación de recursos**
Para desencadenar la generación de código, es necesario primeramente  identificar clases, métodos, u otros elementos en el código fuente. Para esto, `SyntaxProvider` provee el método `CreateSyntaxProvider` que se compone de dos parámetros:
  - **El Predicado** `(Func<SyntaxNode, CancellationToken, bool>)`: Consiste en un análisis sintáctico para descartar rápidamente los nodos que no son de interés. Este paso no contiene información semántica.
  - **La Transformación** `(Func<GeneratorSyntaxContext, CancellationToken, T>)`: Este delegado es el segundo paso, que sí tiene conocimiento semántico. Solo se invoca para los nodos que han pasado el filtro anterior (el análisis del **Predicado**). El argumento `GeneratorSyntaxContext` que recibe como parámetro proporciona acceso al Modelo Semántico, para ahora sí, un análisis profundo de nodos específicos. Aquí es donde se realizarían comprobaciones como verificar qué interfaz implementa una clase o de qué tipo base hereda, si existen argumentos a tener en cuenta, etc..

3.  **Generación del código**. 
El mecanismo principal para la generación de código consiste en registrar un delegado encargado de generar el código en base al filtrado que realizado en el paso anterior. Para esto, `IncrementalGeneratorInitializationContext` cuena con el método `RegisterSourceOutput(IncrementalValueProvider<TSource> source, Action<SourceProductionContext, TSource> action)` que ejecutará el delegado y finalmente añadirá el código generado al compilador.
      

<div id="estrategias-identificacion">

### F. Estrategias para Identificar los Objetivos de Generación

Existen varias estrategias para identificar los elementos del código que deben desencadenar la generación de código, y voy a detallar las principales:

1.  **Por Atributo Marcador (Recomendado)**
Este es el patrón más común, eficiente y recomendado, aunque no el que voy a ejemplificar en este artículo ya que hay documentación de sobra por todo internet. En lugar de usar `CreateSyntaxProvider` manualmente, se debe utilizar el método auxiliar optimizado `context.SyntaxProvider.ForAttributeWithMetadataName()`. Este método está diseñado específicamente para este caso de uso y ofrece un alto rendimiento.

```csharp

// Ejemplo de uso de ForAttributeWithMetadataName
var provider = context.SyntaxProvider.ForAttributeWithMetadataName(
    "My.Namespace.MyMarkerAttribute",
    (node, _) => node is ClassDeclarationSyntax, // El predicado que mencioné antes, que en este caso es opcional
  	(ctx, _) => (ClassDeclarationSyntax)ctx.TargetNode); // La transformación, que se describirá a detalle más adelante.
```

Para que el atributo marcador esté disponible en el proyecto consumidor sin necesidad de una referencia de ensamblado separada, o pretender que el programador la escriba cada vez, su código fuente se puede inyectar directamente en la compilación utilizando `context.RegisterPostInitializationOutput` (se estará usando más adelante).

2.  **Por Implementación de Interfaz**
Esta estrategia requiere análisis semántico (y es la que usaré de ejemplo), por lo que la comprobación debe realizarse en la etapa de transformación.

  - **Predicado**: Un predicado eficiente podría ser `(node, _) => node is ClassDeclarationSyntax c && c.BaseList is not null`. Esto filtra rápidamente las clases que extienen de otro tipo (clases o interfaces).

  - **Transformación**: En el delegado de transformación, se obtiene el `INamedTypeSymbol` de la clase a través de `context.SemanticModel.GetDeclaredSymbol(classDeclarationSyntax)`. Luego, se inspecciona la colección `symbol.AllInterfaces`. Ahora sí, si esta colección contiene la interfaz que buscamos, entonces el nodo es candidato para la generación. La comparación debe hacerse utilizando el nombre de metadatos completo y cualificado de la interfaz para mayor robustez, ya que un proyecto mediano o incluso grande podría tener múltiples interfaces con el mismo nombre en distintos namespaces.
Este método se analizará más a detalle más adelante, por ser el más 'complejo' de implementar.

3.  **Por Otras Pistas Sintácticas o Semánticas**
Los delegados de predicado y transformación se pueden adaptar para cualquier otro criterio, como encontrar clases que heredan de una clase base específica (inspeccionando `symbol.BaseType`), métodos con nombres particulares, propiedades de un tipo determinado, etc. Si ya se cuena con experiencia en Reflexión, los criterios se pueden aplicar aquí también.
  

<div id="implementacion-practica">

## II. Implementación práctica


Ahora sí, manos a la obra con la implementación de un generador de código que sintetice todo lo mencionado anteriormente.

  
1.  **Escenario y configuración**
  - **Objetivo**: Crear un generador que encuentre todas las clases concretas en un ensamblado que implementen la interfaz marcadora `IRepository`. Esto arroja algo de luz sobre cómo sería posible simplificar muchos patrones típicos. 
El generador creará un método de extensión para `IServiceCollection` para registrar cada una de las clases en el contenedor de DI con un ciclo de vida **Scoped**.
  - **Configuración**: Este ejemplo además demostrará la adición de una interfaz marcadora `public interface IRepository()` para no tener que contar con que el desarrollador deba hacerlo por sí mismo. El generador buscará las clases que implementen esta interfaz.

2.  **Construcción del Pipeline del Generador**

> El siguiente código usará algunas pocas líneas para ejemplificar únicamente, pero la implementación completa se puede encontrar [en este repositorio](https://github.com/pablomederos/SourceGeneratorsExample).

El proceso se divide en la definición de la clase del generador y la construcción del pipeline de procesamiento.
Tanto Visual Studio y otros IDEs, así como Dotnet CLI ya cuentan con un template para crear el proyecto con una configuración básica. Se puede partir de ahí mismo, o eliminar los objetos generados automáticamente y sustituirlos por el código que muestro a continuación.
  
**Ejemplo en RIDER**:
  
![generator.png](/generator.png =800x)

1.  **Clase Generadora**: Una clase generadora debe implementar la interfaz `IIncrementalGenerator`, y será decorada con el atributo `[Generator]`

```csharp
[Generator]
public class RepositoryRegistrationGenerator : IIncrementalGenerator
{
    public void Initialize(IncrementalGeneratorInitializationContext context)
    {
        // El pipeline se definirá aquí.
    }
}
```

2.  **Definición del Pipeline**: Dentro del método Initialize, se construye el pipeline paso a paso.

  - Paso 1: **Generar una interfaz marcadora**.
      Como mencioné antes, se puede utilizar una interfaz, un atributo u otras características del código fuente. En este caso, asumiendo que el código fuente no cuenta con un un elemento para marcar los desencadenantes de la generación, se generará una interfaz que se podrá implementar para "marcar" el código.
  
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

Si bien por simplicidad este ejemplo se realizó usando una cadena de texto interpolada para crear la interfaz marcadora, el mismo resultado se podría obtener mediante el uso de **Árboles de Sintaxis**. El código en el repositorio mencionado anteriormente, usa esa estrategia para ilustrar lo dicho, pero valía la pena simplificar el ejemplo.
      
  - Paso 2: **Predicado para encontrar candidatos.**
    Usamos `CreateSyntaxProvider` para encontrar todas las declaraciones de clases que no sean abstractas y que tengan una lista de tipos base. Es decir, queremos solo clases concretas.

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

  - Paso 3: **Transformación para identificar implementaciones de IRepository.**
  
Combinamos los candidatos con el `CompilationProvider` para poder realizar el análisis semántico que se mencionó anteriormente. En la transformación, se verifica si la clase implementa la interfaz que creamos anteriormente `IRepository` y, si es así, se extrae la información necesaria a un DTO (Data Transfer Object) inmutable y equatable, como se discutirá más adelante.
Se filtran los resultados nulos y se recolectan en un ImmutableArray. Esto tiene algunos matices importantes que voy a mencionar más adelante, pero por ahora simplifico el ejemplo.

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

  - Paso 4: **Generación del Método de Extensión**
Finalmente, registramos un delegado que tomará la colección de repositorios y generará el archivo de código fuente.

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

    // Obtener un nombre único para la clase de extensión basado en el nombre del ensamblado.
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

<div id="testeando-generador">

## III. Testeando el generador de código


Un generador de código es una pieza de software que debe ser tan robusta y fiable como cualquier otra. Pasaré a detallar cómo realizar algunas pruebas para el generador que acabamos de probar.
A los efectos de esta documentación se usarán dos enfoques: **Snapshot Testing** y las típicas **Aserciones**.

1.  **Snapshot Testing con** [`Verify`](https://github.com/VerifyTests/Verify\)
Las pruebas de tipo **Snapshot Testing** son una técnica ideal para los generadores de código. En lugar de escribir aserciones manuales sobre el texto generado, el **framework Verify** captura la salida completa del generador (tanto el código generado como los diagnósticos) y la guarda en un archivo `.verified.cs`. En posteriores ejecuciones de la prueba, la nueva salida se compara con este archivo "aprobado". Si hay alguna diferencia, la prueba falla, lo que permite detectar regresiones de manera eficaz.
  

  - **Ejemplo**:
Para inicializar el soporte de Verify se requiere un `ModuleInitializer`
  

```csharp
using System.Runtime.CompilerServices;
using VerifyTests;

public static class ModuleInitializer
{
    [ModuleInitializer]
    public static void Init() => VerifySourceGenerators.Initialize();
}
```

Una prueba típica se vería así *(Ejemplo con XUnit)*:
  

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
        // 1. Arrange: Definir el código fuente de entrada
        const string source = $$"""
                                using {{RepositoryMarker.MarkerNamespace}};
                                namespace MyApplication.Data
                                {
                                    public class UserRepository : {{RepositoryMarker.MarkerInterfaceName}} { }
                                    public class ProductRepository : {{RepositoryMarker.MarkerInterfaceName}} { }
                                    public abstract class BaseRepository : {{RepositoryMarker.MarkerInterfaceName}} { } // No debe ser registrado
                                    public class NotARepository { } // No debe ser registrado
                                }
                                """;

        // 2. Act: Ejecutar el generador
        var compilation = CSharpCompilation.Create(
            "MyTestAssembly",
            [ CSharpSyntaxTree.ParseText(source) ],
            [ MetadataReference.CreateFromFile(typeof(object).Assembly.Location) ]
        );

        GeneratorDriver driver = CSharpGeneratorDriver
            .Create(new RepositoryRegistrationGenerator())
            .RunGenerators(compilation);

        // 3. Assert: Verificar la salida con Verify
        // Esta prueba debe generar los registros para 
        // UserRepository y ProductRepository en la extensión
        return Verifier
            .Verify(
                driver.GetRunResult().Results.Single(),
                _verifySettings
            );
    }
}
```

La primera vez que se ejecute esta prueba, fallará y creará dos archivos: \*.received.cs (la salida real) y \*.verified.cs (el archivo de snapshot (como una captura del estado). El desarrollador debe revisar el archivo *.verified.* para asegurarse de que es correcto y luego aceptarlo.

`CSharpCompilation.Create` permitirá la cración de una compilación, similar a como funcionaría sobre cualquier código fuente.
`CSharpGeneratorDriver` será el encargado de ejecutar el generador sobre la compilación y generar el nuevo código fuente del generador.

2.  **Probando la Incrementalidad con aserciones**

> Si bien este código usa las típicas aserciones incluídas en el framework de testing, en el repositorio se agregó código de ejemplo para el uso de `Verify` como se hizo anteriormente.

Esta es la prueba más crítica para un generador incremental. Demuestra que la caché está funcionando correctamente y que el generador no está haciendo trabajo innecesario. Aquí es donde el uso de `IIncrementalGenerator` ofrece el mayor beneficio de rendimiento.
Los pasos para probar la incrementalidad son básicamente los siguientes:

  - **Marcar los Pasos del Pipeline**: En el código del generador, se añade `.WithTrackingName("StepName")` a las etapas clave del pipeline que se quieren monitorizar.

  - **Configurar el GeneratorDriver**: En la prueba, se crea el `GeneratorDriver` con la opción `trackIncrementalGeneratorSteps: true`.

  - **Realizar Múltiples Ejecuciones**:
    - **Ejecución 1**: Se ejecuta el generador sobre una compilación inicial.
    - **Ejecución 2**: Se crea una nueva compilación añadiendo un cambio trivial a la primera (por ejemplo, un comentario) y se vuelve a ejecutar el generador.
      

  - **Aserción sobre el Motivo de la Ejecución**: Se obtiene el resultado de la segunda ejecución y se comprueba el motivo (**Reason**) por el que se ejecutaron los pasos. Si la caché funcionó, el motivo debería ser `IncrementalStepRunReason.Cached` o `IncrementalStepRunReason.Unchanged`.

```csharp
public class RepositoryRegistrationGeneratorTests
{   
    [Fact]
    public void IncrementalGenerator_CachesOutputs()
    {
        // 1. Arrange: Definir el código fuente de entrada
        const string initialSource = $$"""
                                       using {{RepositoryMarker.MarkerNamespace}};
                                       namespace MyApplication.Data
                                       {
                                           public class UserRepository : {{RepositoryMarker.MarkerInterfaceName}} { }
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

        // 2. Act: Ejecutar el generador
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

            
        // 3. Arrange: Agregar una clase que no es registrable
        const string modifiedSource = $$"""
                                          using {{RepositoryMarker.MarkerNamespace}};
                                          namespace MyApplication.Data
                                          {
                                              public class UserRepository : {{RepositoryMarker.MarkerInterfaceName}} { }
                                                  
                                              // Este cambio no debería provocar la regeneración de la salida
                                              // porque la clase no implementa la interfaz del marcador.
                                              public class NotARelevantChange { }
                                          }
                                          """;
        SyntaxTree modifiedSyntaxTree = CSharpSyntaxTree
            .ParseText(modifiedSource, path: "TestFile.cs");
        CSharpCompilation incrementalCompilation = initialCompilation
            .ReplaceSyntaxTree(initialSyntaxTree, modifiedSyntaxTree);
            
            
        // 4. Act: Ejecutar el generador
        driver = driver.RunGenerators(incrementalCompilation);
        GeneratorRunResult result = driver
            .GetRunResult()
            .Results
            .Single();
            
  
        // 5. Assert: El paso [CheckClassDeclarations]
            
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

<div id="rendimiento-cache">

## IV. El rendimiento que ofrece la caché


Entender cómo funciona la caché del generador podría ser la diferencia entre un generador ultrarápido y uno que bloquea el IDE. Por eso fue importante realizar la prueba de caché de la sección anterior.

<div id="motor-cache">

#### A. El Motor de Caché: Memoización en el Pipeline

Como se mencionó anteriormente, el pipeline de un generador incremental es un grafo de flujo de datos. El motor de Roslyn memoiza (almacena en caché) la salida de cada nodo de este grafo. En las ejecuciones siguientes, si las entradas de un nodo se consideran idénticas a las de la ejecución anterior (mediante una comprobación de igualdad), se utiliza instantáneamente la salida almacenada en caché, y los nodos descendentes no se vuelven a ejecutar a menos que otras de sus entradas hayan cambiado. La clave de todo el sistema reside en esa "comprobación de igualdad".   

<div id="isymbol-rendimiento">

#### B. `ISymbol`: Su efecto en el Rendimiento

Este es el error más común que se puede cometer al escribir un generador incremental.

  - **El Problema**: Los objetos `ISymbol` (que representan tipos, métodos, etc.) y los objetos `Compilation` no son estables entre compilaciones ya que dependen del código fuente que representan. Incluso para exactamente el mismo código fuente, una nueva pasada de compilación (desencadenada por una pulsación de tecla, por ejemplo) generará nuevas instancias de `ISymbol` que no son iguales por referencia a las antiguas.

  - **La Consecuencia**: Si un `ISymbol` o cualquier objeto que lo contenga (como un `ClassDeclarationSyntax` que se combina con el `CompilationProvider`) se utiliza como dato dentro de un `IncrementalValueProvider`, la comprobación de igualdad de la caché siempre fallará. Esto obliga al pipeline a reejecutarse desde ese punto en adelante con cada cambio, anulando por completo el propósito de la generación incremental.   

  - **Desperdicio de Memoria**: Un efecto secundario grave es que mantener referencias a objetos ISymbol en el pipeline puede "anclar" compilaciones enteras en memoria, impidiendo que el recolector de basura las libere. En soluciones grandes, esto conduce a un consumo de memoria terrible por parte del proceso del IDE (por ejemplo, `RoslynCodeAnalysisService`), con informes de uso de 6-10 GB de RAM o más. [Issue en GitHub](https://github.com/dotnet/roslyn/issues/62674)

<div id="patron-dto-equatable">

#### C. Mejor Práctica: El Patrón del DTO Equatable

La solución definitiva y no negociable a este problema es transformar la información semántica en un Objeto de Transferencia de Datos (DTO) simple, inmutable y equatable lo antes posible en el pipeline, que es lo que hice en el ejemplo de código con el tipo `RepositoryToRegister`.

  - Implementación: Utilizar un `record struct` para el DTO. Esto proporciona semántica de igualdad basada en valores de forma gratuita y, al ser un struct, evita asignaciones en el heap para objetos pequeños.   

  - Proceso: En la etapa de transformación (el segundo delegado de `CreateSyntaxProvider` o `ForAttributeWithMetadataName`), se debe:

  1. **Inspeccionar el ISymbol.**
  2. Extraer únicamente los datos primitivos necesarios para la generación (nombres como `string`, indicadores como `bool`, etc.).
  3. Poblar una nueva instancia del DTO record struct.
  4. **Devolver el DTO.**
  El ISymbol se descarta inmediatamente y nunca entra en la caché del pipeline incremental.
  

<div id="optimizar-pipeline">

#### D. Optimizar la Estructura del Pipeline

Además del patrón DTO, hay otras optimizaciones estructurales posibles.

  - **Colecciones**: El tipo estándar `ImmutableArray<T>` no es equatable por valor; utiliza igualdad por referencia. Pasarlo a través del pipeline romperá la caché. La solución es utilizar `EquatableArray<T>` (del paquete NuGet CommunityToolkit.Mvvm) o envolver el proveedor con un `IEqualityComparer<T>` personalizado usando el método `.WithComparer()`.   

  - **Combinación de Proveedores**: Al usar `.Combine()`, se debe evitar combinar con el `context.CompilationProvider` completo, ya que este objeto cambia frecuentemente. Lo mejor es usar `.Select()` para extraer solo los datos necesarios (por ejemplo, `context.CompilationProvider.Select((c,_) => c.AssemblyName)`) y combinar con ese proveedor más pequeño y estable. El orden de las combinaciones también puede afectar el tamaño de la caché. Me repito nuevamente en este sentido porque es muy común intentar pasar un `ISymbol` e icluso la compilación completa en lugar de únicamente los datos que se requieren para la generación.
      
      
<div id="tabla-mejores-practicas">

#### E. Tabla: Mejores Prácticas de Caché para Generadores Incrementales

La siguiente tabla resume lo que considero como "reglas" de rendimiento, contrastando los antipatrones comunes con las mejores prácticas recomendadas. Sirve como una lista de verificación para auditar y optimizar un generador incremental aunque cada quien irá haciendo su propio camino a media que lo recorre.

|Preocupación|Anti-Patrón (Rompe la Caché y Desperdicia Memoria)|Mejor Práctica (Habilita la Caché y Ahorra Memoria)|Justificación y Referencias|
|-|-|-|-|
|Transferencia de Datos|**IncrementalValueProvider**&lt;**ISymbol**&gt; o **IncrementalValueProvider**&lt;**ClassDeclarationSyntax**&gt;|**IncrementalValueProvider**&lt;**MyEquatableRecordStruct**&gt;|Los objetos `ISymbol` y `SyntaxNode` no son estables entre compilaciones y anclan grandes grafos de objetos. Los DTOs con igualdad por valor son pequeños y estables.|
|Colecciones|**IncrementalValueProvider**&lt;**ImmutableArray**&lt;**T**&gt;&gt;|**IncrementalValueProvider**&lt;**EquatableArray**&lt;**T**&gt;&gt; o usar `.WithComparer()`|**ImmutableArray**&lt;**T**&gt; usa igualdad por referencia. **EquatableArray**&lt;**T**&lt; del **Community Toolkit** proporciona la igualdad estructural necesaria para la caché.|
|Datos de Compilación|`provider.Combine(context.CompilationProvider)`|`var asm = c.CompilationProvider.Select(...); provider.Combine(asm)`|El objeto Compilation completo cambia en casi cada pulsación de tecla. Seleccionar solo los datos necesarios (p. ej., el nombre del ensamblado) crea una entrada mucho más estable para el paso Combine.|
|Tipo de Modelo de Datos|Usar una `class` estándar con igualdad por referencia por defecto para su DTO.|Usar un `record` o `record struct` para el DTO.|Los record proporcionan una igualdad basada en valores generada automáticamente por el compilador, que es exactamente lo que el mecanismo de caché requiere para funcionar correctamente.|

<div id="conclusion-recomendaciones">

## V. Conclusión y Recomendaciones Finales

  
El viaje a través de los generadores de código incrementales revela una tecnología que es a la vez poderosa y matizada. `IIncrementalGenerator` se ha consolidado como el pilar de la metaprogramación en tiempo de compilación en .NET, no solo como una optimización, sino como un habilitador fundamental para la dirección estratégica de la plataforma hacia el rendimiento, la eficiencia y la compatibilidad con AOT.
Este es el primer artículo que escribo sobre este tema, pero no será el único, ya que quisiera posteriormente abarcar otros temas como los interceptores, publicación de un paquete NuGet, y buenas prácticas y herramientas que agilizan el desarrollo así como la revisión de código, ya sea en un proyecto independiente como en el trabajo en equipo.

Creo que los principios clave para dominar esta tecnología son claros:

  - **Adopción Obligatoria:** `IIncrementalGenerator` no es una opción, sino un requisito para cualquier generador de código que se preocupe por el rendimiento y la experiencia del desarrollador.

  - **El Rendimiento es un Pipeline**: El rendimiento se dicta por la construcción de un pipeline de datos bien estructurado y consciente de la caché.

  - **La Caché Depende de la Igualdad**: La eficacia de la caché depende de transformar los símbolos semánticos, que son inherentemente inestables, en DTOs simples, inmutables y equatables lo antes posible.

  - **La Robustez Exige Pruebas**: La corrección y el rendimiento deben garantizarse a través de un conjunto de pruebas exhaustivo que incluya tanto pruebas de instantáneas para la salida como pruebas de incrementalidad para la eficiencia de la caché.

A continuación, se presenta una lista de verificación de mejores prácticas para los autores de generadores de código incrementales, que resume las recomendaciones críticas discutidas a lo largo de este informe:

Lista de Verificación para Autores de Generadores Incrementales
☑️ **Usar** `IIncrementalGenerator`: Implementar siempre `IIncrementalGenerator` y evitar la interfaz heredada `ISourceGenerator`.

☑️ **Apuntar a** *netstandard2.0*: Configurar el proyecto del generador para que apunte a *netstandard2.0* para una máxima compatibilidad.

☑️ **Usar el Patrón DTO Equatable**: Nunca pasar ISymbol, Compilation o SyntaxNode directamente a través del pipeline. Transformarlos en record struct DTOs que contengan solo los datos primitivos necesarios.

☑️ **Utilizar ForAttributeWithMetadataName**: Para la detección basada en atributos, preferir siempre este método optimizado sobre un CreateSyntaxProvider manual.

☑️ **Inyectar Atributos Marcadores**: Usar `RegisterPostInitializationOutput` para inyectar el código fuente de los atributos marcadores en la compilación del consumidor.

☑️ **Ser Estratégico con Combine**: Evitar combinar con el `CompilationProvider` completo. En su lugar, usar `.Select()` para extraer solo la información necesaria (p. ej., `AssemblyName`) y combinar con ese proveedor más pequeño.

☑️ **Usar Colecciones Equatables**: Al trabajar con colecciones, usar **EquatableArray**\<**T**> o un **IEqualityComparer**\<**T**> personalizado para garantizar que la caché funcione.

☑️ **Implementar Pruebas de Snapshot Testing**: Usar una biblioteca como `Verify` para crear pruebas de instantáneas que validen la exactitud del código generado y los diagnósticos.

☑️ **Implementar Pruebas de Incrementalidad**: Escribir pruebas específicas que verifiquen que los pasos del pipeline se obtienen de la caché (**Reason** == **Cached**/**Unchanged**) en cambios de código triviales.