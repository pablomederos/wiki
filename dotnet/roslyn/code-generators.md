---
title: Metaprogramación con Generadores de código
description: Guia exaustiva sobre la generación de código usando las apis del compilador Roslyn
published: false
date: 2025-06-24T00:30:48.794Z
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

La metaprogramación es la capacidad de un programa de tratar a otros programas (o a sí mismo) como datos. Esto ha permitido la evolución de los frameworks a lo largo de los años. .NET provee múltiples técnicas con este propósito, como la reflexión (runtime reflection), y las plantillas de texto (T4 templates). Sin embargo, ambos enfoques presentan sus inconvenientes introduciendo una penalización en el rendimiento, durante el arranque en frío de la aplicación o durante su ejecución, ya que en el caso de la reflexión, el framework debe analizar el código durante el tiempo de ejecución, lo que conlleva un costo fijo extra de tiempo que no es posible optimizar.

Con la llegada de la plataforma de compilación llamada `Roslyn`, se pasó de una "caja negra" a una plataforma abierta con apis para el análisis y la generación de código. Esto llevó, entre otras cosas, al surgimiento de los **Source Generators**. Se trata de un componente que analiza el código en tiempo de compilación y produce archivos fuente adicionales, que se compilan con el resto del código.

La idea central de este artículo, es entender qué es un generadore de código incremental, cómo este mejora el rendimiento de la aplicación y mejora la relación entre el desarrollador y el código, así como también, presentar al ahora estándar de metaprogramación en tiempo de compilación de C\#, para el desarrollo de bibliotecas modernas y de alto rendimiento.

<div id="generacion-incremental-fundamento-y-aplicacion">

## I. Generación incremental: Fundamento y aplicación


<br>

<div id="ventajas-fundamentales">

### A. Ventajas fundamentales de la generación  de código en tiempo de compilación


<br>

1.  **Mejora del rendimiento**
    Como se mencionó anteriormente, ahora en lugar de realizar un análisis durante el tiempo de ejecución, la carga se desplaza al tiempo de compilación, reduciendo así el arranque de las aplicación, y la respuesta general durante la ejecución normal de un proceso.
      Ejemplo de una implementación actual que ofrece los beneficios antes mencionados, es el atributo `GeneratedRegexAttribute`, introducido en **.NET 7**, evita la compilación de una expresión regular en tiempo de ejecución, generando código en tiempo de compilación, optimizado, que evalúa las coinidencias, resultando en una mejora drástica en el rendimiento. Otro ejemplo podría ser el atributo [`LibraryImport`](https://www.google.com/search?q=%5Bhttps://learn.microsoft.com/en-us/dotnet/standard/native-interop/pinvoke-source-generation%5D\(https://learn.microsoft.com/en-us/dotnet/standard/native-interop/pinvoke-source-generation\)), que viene a ser un sustituto a `DllImport`, así como también, son ejemplo las técnicas avanzadas que utiliza actualmente Blazor para convertir los templates razor a clases generadas, especializadas en la generación de documentos HTML.
      
2.  **Eliminación de código repetivo (Boilerplate)**
      Otro de los beneficios es la automatización de la escritura de código repetitivo y propenso a errores, como podría ser la creación de DTOs, mapeadores de código, o incluso DAOs y funciones de acceso a bases de datos o recursos de red.
      
3.  **Modelos de despliegue modernos**
      Quizá una de las ventajas más importantes (al menos para este servidor), es la compatibilidad con tecnologías de optimización modernas como pueden ser la compilación **AOT** ([Ahead-of-Time](https://learn.microsoft.com/en-us/dotnet/core/deploying/native-aot/?tabs=windows%2Cnet8)), o el **Trimming** ([Recorte de ensamblados](https://learn.microsoft.com/en-us/dotnet/core/deploying/trimming/trim-self-contained)). Estas tecnologías son más compatibles con entornos en la nube, móviles, o casos de uso de alto rendimiento y bajo consumo de recursos. En estos casos donde la compatibilidad con reflexión es inexistente, o el rendimiento es primordial, la generación de código permite obtener todo el código necesario durante la compilación, pasando de una simple optimización a un pilar arquitectónico de la estrategia de **.NET** para el futuro.
      

<div id="casos-de-uso">

### B. Casos de uso en el ecosistema .NET


Los generadores de código no son un fenómeno aislado, de nicho, sin que actualmente están profundamente integrados en la plataforma **.NET**.

1.  **Serializador `System.Text.Json`**
      El serializador **JSON** integrado en .NET es un claro ejemplo de caso de uso. Mediante el uso del atributo `JsonSerializableAttribute` aplicado a una clase parcial que extienda de `JsonSerializerContext`, es posible activar un generador de código que analiza los tipos y produce lógica de serialización y deserialización muy optimizada en tiempo de compilación. Esto tiene como resultado una [mejora del rendimiento de hasta un 40%](https://okyrylchuk.dev/blog/intro-to-serialization-with-source-generation-in-system-text-json/) en el arranque gracias a evitar el uso de la reflexión.

**El generador utiliza dos modos de operación:**
  - **Modo basado en metadatos**: Recolecta de antemano los metadatos necesarios de los tipos, para acelerar la serialización y deserialización.
  - **Modo de optimización de serialización**: Genera el código utilizando `Utf8JsonWriter` directamente, ofreciendo el máximo rendimiento posible de serialización. Este modo es más restrictivo y no soporta todas las opciones de personalización.
> Más detalles en [Microsoft Learn: serialization/system text json/source generation](https://learn.microsoft.com/en-us/dotnet/standard/serialization/system-text-json/source-generation)
  
2. **ASP.NET Core y Native AOT**
  ASP.NET Core utiliza el generador incorporado `RequestDelegateGenerator`, para hacer que las Minimal APIs sean compatibles con **Native AOT**. Esta característica hace uso de los `interceptors`, de que se tratarán más adelante en este artículo. Pero básicamente, **intercepta** las llamadas a `app.MapGet()` que normalmente dependerían de reflexión, reemplazándolas por lógica precompilada. El producto de esto es un ejecutable nativo y altamente optimizado.
  
3. **Inyección de dependencias**
  Muchos contenedores de Inyección de Dependencias de alto rendimiento ([Pure.DI](https://github.com/DevTeam/Pure.DI), [Injectio](https://github.com/loresoft/Injectio), [Jab](https://github.com/pakrym/jab), [StrongInject](https://github.com/YairHalberstadt/stronginject) [*algunos más activos que otros*]) han adoptado el uso de generadores de código, permitiendo generar el grafo de dependencias durante la compilación además de detectar en esta misma fase, aquellas dependencias que aún no fueron implementadas o que se encuentran incompletas. Esto reduce la probabilidad de recibir excepciones en tiempo de ejecución, y sin mencionar la mejora en el rendimiento.
  

<div id="consideraciones-de-portabilidad">

### C. Consideraciones de portabilidad


Al desarrollar un generador de código, se requiere tener en cuenta el entorno en el que se ejecutará.

1.  **Framework de destino (Target Framework)**
      Es importante que el proyecto generador tenga como framework de destino `netstandard2.0` para maximizar la compatibilidad con diferentes versiones de **Visual Studio**, **MSBuild**, el **SDK de .NET** e incluso algunos otros IDEs.
      
2.  **IDE vs. Compilación en Línea de Comandos**
      El pipeline incremental, así como el sistema de caché (que se tratará más adelante en este artículo), están diseñados principalmente para maximizar la experiencia en un IDE (**Visual Studio**, **Rider**, etc.), ofreciendo una retroalimentación inmediata al desarrollador. En caso de usarse la línea de comandos, este proceso de compilación no será automático y probablemente requiera el desarrollo de un script que mejore esta experiencia. Editores como **Visual Studio Code** y derivados podrían ya contar con soporte integrado mediante las extensiones oficiales de **.NET** y **C\#** ([C\# Dev Kit](https://marketplace.visualstudio.com/items?itemName=ms-dotnettools.csdevkit) u otras).
      
3.  **Entornos multiplataforma**
      El desarrollo en **Unity** u otras plataformas podría requerir configuración adicional para que se reconozcan los generadores como un componente de compilación. Cada cual lo tendrá seguramente documentado para cada caso puntual.
      

<div id="evolucion-isourcegenerator">

### D. Evolución de `ISourceGenerator` hacia `IIncrementalGenerator`


En pocas palabras, el uso de la interfaz `ISourceGenerator` no es una opción en absoluto. `IIncrementalGenerator` es la única opción, ya que la anterior se considera obsoleta.

1.  **Comparación "arquitectónica": Imperativo vs Declarativo**
      La diferencia entre ambas interfaces representa un cambio significativo en el modelo de programación:
      - `ISourceGenerator`: Expone dos métodos: `Initialize` y `Execute`, combinado con una implementación de `ISyntaxReceiver` o `ISyntaxContextReceiver`. El `ISyntaxReceiver` realiza un recorrido por todos los árboles de sintaxis de una compilación de forma imperativa, recopilando datos de los nodos, posteriormente invoca al método `Execute`, el cual recibe la compilación completa y el receptor poblado para realizar la generación. Como se mencionó, se trata de un modelo imperativo, y además basado en eventos.
      - `IIncrementalGenerator`: Solo contiene el método `Initialize`, dentro del cual el desarrollador escribe de forma declarativa el flujo de transformaciones de datos, en una sitaxis similar a LINQ. Este flujo describe como se trasladan los datos desde la entrada (código fuente u otros archivos adicionales) hasta el código generado.
      
2.  **Rendimiento inferior de `ISourceGenerator`**
      En pocas palabras, el método `Execute` de `ISourceGenerator` se activa con cada pulsación o cambio en el proyecto, obligando a la reevaluación de la lógica, lo que resulta en un rendimiento catastrófico del IDE. `IIncrementalGenerator` resuleve este problema, y permite a **Roslyn** usar una técnica de **Memoization** sobre los resultados de cada etapa, lo que aumenta la eficiencia y solo requiere ejecutarse para cambios en la entrada de datos. Además, `IIncrementalGenerator` separa la etapa inicial de comprobación sintáctica, de la más costosa que es la transformación, siendo esta una etapa que implica análisis semántico. Este punto hace posible que el compilador pueda ejecutar el generador en muchos nodos, pero solo invocar la transformación en aquellos que se filtraron en la primera etapa.
      

<div id="elementos-generador">

### E. Elementos de un Generador de Código


1.  **El Punto de Entrada**
      El único punto de entrada de un Generador de Codigo es el método `Initialize`. El parámtro `IncrementalGeneratorInitializationContext` ofrece acceso a los diferentes proveedores de datos que son la base de cualquier generador.
      Los proveedores disponibles entre otros son:
      - `SyntaxProvider`: Permite la consulta de árboles de sintaxis
      - `CompilationProvider`: Permite acceder a la compilación completa, incluyendo información semántica.
      - `AdditionalTextsProvider`: Para leer otros archivos en el proyecto que no son archivos fuente (json, txt, xml, etc.).

2.  **Identificación de recursos**
      Al intentar identificar clases, métodos, u otros elementos en el código fuente que desencadenarán la generación de código. `SyntaxProvider` provee el método `CreateSyntaxProvider` que se compone de dos parámetros:
      - **El Predicado** `(Func<SyntaxNode, CancellationToken, bool>)`: Consiste en un análisis meramente sintáctico que permite descartar de forma rápido aquellos nodos que no son de interés. Este paso no contiene información semántica.
      - **La Transformación** `(Func<GeneratorSyntaxContext, CancellationToken, T>)`: Este delegado se ejecuta en un segundo paso, que sí tiene conocimiento semántico. Solo se invoca para los nodos que han pasado el filtro anterior. El argumento `GeneratorSyntaxContext` que recibe como parámetro proporciona acceso al Modelo Semántico, lo que permite un análisis profundo y preciso del código. Aquí es donde se realizarían comprobaciones como verificar qué interfaz implementa una clase o de qué tipo base hereda.

3.  **Generación del código**. 
      El mecanismo principal para la generación de código consiste en registrar una acción capaz de generar el código fuente basado en el filtrado que se realizó en el paso anterior. Para esto, `IncrementalGeneratorInitializationContext` posee un método llamado `RegisterSourceOutput(IncrementalValueProvider<TSource> source, Action<SourceProductionContext, TSource> action)` que ejecutará dicha acción y finalmente añadirá el código generado al compilador.
      

<div id="estrategias-identificacion">

### F. Estrategias para Identificar los Objetivos de Generación

Existen varias estrategias para identificar los elementos del código que deben desencadenar la generación de código.

1.  **Por Atributo Marcador (Recomendado)**
    Este es el patrón más común, eficiente y recomendado. En lugar de usar `CreateSyntaxProvider` manualmente, se debe utilizar el método auxiliar optimizado `context.SyntaxProvider.ForAttributeWithMetadataName()`. Este método está diseñado específicamente para este escenario y ofrece un alto rendimiento.

```csharp

// Ejemplo de uso de ForAttributeWithMetadataName
var provider = context.SyntaxProvider.ForAttributeWithMetadataName(
    "My.Namespace.MyMarkerAttribute",
    (node, _) => node is ClassDeclarationSyntax, // Predicado adicional opcional
    (ctx, _) => (ClassDeclarationSyntax)ctx.TargetNode); // Transformación
```

Para que el atributo marcador esté disponible en el proyecto consumidor sin necesidad de una referencia de ensamblado separada, su código fuente se puede inyectar directamente en la compilación utilizando `context.RegisterPostInitializationOutput` (se estará usando más adelante).

2.  **Por Implementación de Interfaz**
    Esta estrategia requiere análisis semántico, por lo que la comprobación debe realizarse en la etapa de transformación (segunda etapa mencionada anteriormente).

  - **Predicado**: Un predicado eficiente podría ser `(node, _) => node is ClassDeclarationSyntax c && c.BaseList is not null`. Esto filtra rápidamente las clases que declaran una lista de bases (clases base o interfaces), que es un requisito previo para implementar una interfaz.   

  - **Transformación**: En el delegado de transformación, se obtiene el `INamedTypeSymbol` de la clase a través de `context.SemanticModel.GetDeclaredSymbol(classDeclarationSyntax)`. Luego, se inspecciona la colección `symbol.AllInterfaces`. Si esta colección contiene la interfaz de destino, el nodo es un candidato para la generación. La comparación debe hacerse utilizando el nombre de metadatos completo y cualificado de la interfaz para mayor robustez.
    Este método se analizará más a detalle más adelante, por ser el más complejo de implementar.

3.  **Por Otras Pistas Sintácticas o Semánticas**
    El mismo patrón de predicado/transformación se puede adaptar para cualquier otro criterio, como encontrar clases que heredan de una clase base específica (inspeccionando `symbol.BaseType`), métodos con nombres particulares, propiedades de un tipo determinado, etc.
      

<div id="implementacion-practica">

## II. Implementación práctica


En esta sección se demuestra la implementación de un generador de código enfocado en registrar repositorios en un contenedor de inyección de dependencias.

1.  **Escenario y configuración**
      - **Objetivo**: Crear un generador que encuentre todas las clases concretas en un ensamblado que implementen la interfaz marcadora `IRepository`. El generador creará un método de extensión para `IServiceCollection` que registrará cada una de estas clases en el contenedor de DI con un ciclo de vida **Scoped**.
      - **Configuración**: En el proyecto que se consuma el generador, se definirá una interfaz marcadora `public interface IRepository()`. El generador buscará las clases que implementen esta interfaz.

2.  **Construcción del Pipeline del Generador**

> El siguiente código usará algunas pocas líneas para ejemplificar únicamente, pero la implementación completa se puede encontrar [en este repositorio](https://github.com/pablomederos/SourceGeneratorsExample).

El proceso se divide en la definición de la clase del generador y la construcción de su pipeline de procesamiento.

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
      Como se mencionó anteriormente, se puede utilizar una interfaz, un atributo u otras características semánticas o sintácticas del código fuente. En este caso, asumiendo que el código fuente no cuenta con un un elemento para marcar los desencadenantes de la generación, se generará una interfaz que se podrá implementar para "marcar" el código.
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

      Si bien por simplicidad este ejemplo se realizó usando una cadena de texto interpolada para crear la interfaz marcadora, el mismo resultado se podría obtener mediante el uso de **Árboles de Sintaxis**. El código en el repositorio mencionado anteriormente, usa esa estrategia para ilustrar lo dicho.
      
  - Paso 2: **Predicado para encontrar candidatos.**
    Usamos `CreateSyntaxProvider` para encontrar todas las declaraciones de clases que no sean abstractas y que tengan una lista de tipos base.

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
    Combinamos los candidatos con el CompilationProvider para poder realizar análisis semántico que se mencionó anteriormente. En la transformación, se verifica si la clase implementa la interfaz que creamos anteriormente `IRepository` y, si es así, se extrae la información necesaria a un DTO (Data Transfer Object) inmutable y equatable, como se discutirá más adelante.
    Se filtran los resultados nulos y se recolectan en un ImmutableArray.

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
    ```

  - Paso 4: **Generación del Método de Extensión**
    Finalmente, registramos una acción de salida que tomará la colección de repositorios y generará el archivo de código fuente.

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


Un generador de código es una pieza de software que debe ser tan robusta y fiable como cualquier otra. Esta sección detalla cómo construir un conjunto de pruebas completo para el generador de registro de repositorios.
A los efectos de esta documentación se usarán dos enfoques: **Snapshot Testing** y las típicas **Aserciones**.

1.  **Snapshot Testing con** [`Verify`](https://github.com/VerifyTests/Verify\)
    Las pruebas de tipo **Snapshot Testing** son una técnica ideal para los generadores de código. En lugar de escribir aserciones manuales sobre el texto generado, el `framework Verify` captura la salida completa del generador (tanto el código generado como los diagnósticos) y la guarda en un archivo `.verified.cs`. En ejecuciones posteriores, la nueva salida se compara con este archivo "aprobado". Si hay alguna diferencia, la prueba falla, lo que permite detectar regresiones de manera muy eficaz.

  - **Ejemplo**:

  Para inizializar el soporte de Verify se requiere un `ModuleInitializer`
  

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

La primera vez que se ejecute esta prueba, fallará y creará dos archivos: \*.received.cs (la salida real) y \*.verified.cs (el archivo de instantánea, inicialmente una copia del recibido). El desarrollador debe revisar el archivo *.verified.* para asegurarse de que es correcto y luego aceptarlo.

`CSharpCompilation.Create` permitirá la cración de una compilación, similar a como funcionaría sobre cualquier código fuente.
`CSharpGeneratorDriver` será el encargado de ejecutar el generador sobre la compilación y generar el nuevo código fuente del generador.

2.  **Probando la Incrementalidad con aserciones**

> Si bien este código usa las típicas aserciones incluídas en el framework de testing, en el repositorio se agregó código de ejemplo para el uso de `Verify` como se hizo anteriormente.

Esta es la prueba más crítica para un generador incremental. Demuestra que la caché está funcionando correctamente y que el generador no está realizando trabajo innecesario.
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


Entender cómo funciona la caché del generador podría ser la diferencia entre un generador ultrarápido y uno que bloquea el IDE.

<div id="motor-cache">

#### A. El Motor de Caché: Memoización en el Pipeline

Como se mencionó anteriormente, el pipeline de un generador incremental es un grafo de flujo de datos. El motor de Roslyn memoiza (almacena en caché) la salida de cada nodo de este grafo. En ejecuciones posteriores, si las entradas de un nodo se consideran idénticas a las de la ejecución anterior (mediante una comprobación de igualdad), se utiliza instantáneamente la salida almacenada en caché, y los nodos descendentes no se vuelven a ejecutar a menos que otras de sus entradas hayan cambiado. La clave de todo el sistema reside en esa "comprobación de igualdad".   

<div id="isymbol-rendimiento">

#### B. `ISymbol`: Su efecto en el Rendimiento

Este es el error más común y devastador que se puede cometer al escribir un generador incremental.

  - **El Problema**: Los objetos `ISymbol` (que representan tipos, métodos, etc.) y los objetos `Compilation` no son estables entre compilaciones. Incluso para exactamente el mismo código fuente, una nueva pasada de compilación (desencadenada por una pulsación de tecla, por ejemplo) generará nuevas instancias de `ISymbol` que no son iguales por referencia a las antiguas.

  - **La Consecuencia**: Si un `ISymbol` o cualquier objeto que lo contenga (como un `ClassDeclarationSyntax` que se combina con el `CompilationProvider`) se utiliza como el dato dentro de un `IncrementalValueProvider`, la comprobación de igualdad de la caché siempre fallará. Esto obliga al pipeline a reejecutarse desde ese punto en adelante con cada cambio, anulando por completo el propósito de la generación incremental.   

  - **La Catástrofe de Memoria**: Un efecto secundario grave es que mantener referencias a objetos ISymbol en el pipeline puede "anclar" (root) `Compilation` enteras en memoria, impidiendo que el recolector de basura las libere. En soluciones grandes, esto conduce a un consumo de memoria catastrófico por parte del proceso del IDE (por ejemplo, `RoslynCodeAnalysisService`), con informes de uso de 6-10 GB de RAM o más. [Issue en GitHub](https://github.com/dotnet/roslyn/issues/62674)

<div id="patron-dto-equatable">

#### C. Mejor Práctica: El Patrón del DTO Equatable

La solución definitiva y no negociable a este problema es transformar la información semántica en un Objeto de Transferencia de Datos (DTO) simple, inmutable y equatable lo antes posible en el pipeline.

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

  - **Combinación de Proveedores**: Al usar `.Combine()`, se debe evitar combinar con el `context.CompilationProvider` completo, ya que este objeto cambia frecuentemente. En su lugar, se debe usar `.Select()` para extraer solo los datos necesarios (por ejemplo, `context.CompilationProvider.Select((c,_) => c.AssemblyName)`) y combinar con ese proveedor más pequeño y estable. El orden de las combinaciones también puede afectar el tamaño de la caché.
      

<div id="tabla-mejores-practicas">

#### E. Tabla: Mejores Prácticas de Caché para Generadores Incrementales

La siguiente tabla resume las reglas críticas de rendimiento, contrastando los antipatrones comunes con las mejores prácticas recomendadas. Sirve como una lista de verificación para auditar y optimizar un generador incremental.

|Preocupación|Anti-Patrón (Rompe la Caché y Desperdicia Memoria)|Mejor Práctica (Habilita la Caché y Ahorra Memoria)|Justificación y Referencias|
|-|-|-|-|
|Transferencia de Datos|**IncrementalValueProvider**&lt;**ISymbol**&gt; o **IncrementalValueProvider**&lt;**ClassDeclarationSyntax**&gt;|**IncrementalValueProvider**&lt;**MyEquatableRecordStruct**&gt;|Los objetos `ISymbol` y `SyntaxNode` no son estables entre compilaciones y anclan grandes grafos de objetos. Los DTOs con igualdad por valor son pequeños y estables.|
|Colecciones|**IncrementalValueProvider**&lt;**ImmutableArray**&lt;**T**&gt;&gt;|**IncrementalValueProvider**&lt;**EquatableArray**&lt;**T**&gt;&gt; o usar `.WithComparer()`|**ImmutableArray**&lt;**T**&gt; usa igualdad por referencia. **EquatableArray**&lt;**T**&lt; del **Community Toolkit** proporciona la igualdad estructural necesaria para la caché.|
|Datos de Compilación|`provider.Combine(context.CompilationProvider)`|`var asm = c.CompilationProvider.Select(...); provider.Combine(asm)`|El objeto Compilation completo cambia en casi cada pulsación de tecla. Seleccionar solo los datos necesarios (p. ej., el nombre del ensamblado) crea una entrada mucho más estable para el paso Combine.|
|Tipo de Modelo de Datos|Usar una `class` estándar con igualdad por referencia por defecto para su DTO.|Usar un `record` o `record struct` para el DTO.|Los record proporcionan una igualdad basada en valores generada automáticamente por el compilador, que es exactamente lo que el mecanismo de caché requiere para funcionar correctamente.|

<div id="conclusion-recomendaciones">

## V. Conclusión y Recomendaciones Finales

  
El viaje a través de los generadores de código incrementales revela una tecnología que es a la vez poderosa y matizada. `IIncrementalGenerator` se ha consolidado como el pilar de la metaprogramación en tiempo de compilación en .NET, no solo como una optimización, sino como un habilitador fundamental para la dirección estratégica de la plataforma hacia el rendimiento, la eficiencia y la compatibilidad con AOT.

Los principios clave para dominar esta tecnología son claros:

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