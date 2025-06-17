---
title: Metaprogramación con Generadores de código
description: Guia exaustiva sobre la generación de código usando las apis del compilador Roslyn
published: false
date: 2025-06-17T16:33:31.553Z
tags: roslyn, roslyn api, análisis de código, source generators, análisis estático, syntax tree, code analysis, árbol de sintaxis, api de compilador roslyn, .net source generators, code generators, generadores de código
editor: markdown
dateCreated: 2025-06-17T12:46:28.466Z
---



La metaprogramación es la capacidad de un programa de tratar a otros programas (o a sí mismo) como datos. Esto ha permitido la evolución de los frameworks a lo largo de los años. .NET provee múltiples técnicas con este propósito, como la reflexión (runtime reflection), y las plantillas de texto (T4 templates). Sin embargo, ambos enfoques presentan sus inconvenientes introduciendo una penalización en el rendimiento, durante el arranque en frío de la aplicación o durante su ejecución, ya que en el caso de la reflexión, el framework debe analizar el código durante el tiempo de ejecución, lo que conlleva un costo fijo extra de tiempo que no es posible optimizar.

Con la llegada de la plataforma de compilación llamada `Roslyn`, se pasó de una "caja negra" a una plataforma abierta con apis para el análisis y la generación de código. Esto llevó, entre otras cosas, al surgimiento de los **Source Generators**. Se trata de un componente que analiza el código en tiempo de compilación y produce archivos fuente adicionales, que se compilan con el resto del código.

La idea central de este artículo, es entender qué es un generadore de código incremental, cómo este mejora el rendimiento de la aplicación y mejora la relación entre el desarrollador y el código, así como también, presentar al ahora estándar de metaprogramación en tiempo de compilación de C#, para el desarrollo de bibliotecas modernas y de alto rendimiento.


## Generación incremental: Fundamento y aplicación

</br>

### Ventajas fundamentales de la generación  de código en tiempo de compilación

</br>

1. **Mejora del rendimiento**
	Como se mencionó anteriormente, ahora en lugar de realizar un análisis durante el tiempo de ejecución, la carga se desplaza al tiempo de compilación, reduciendo así el arranque de las aplicación, y la respuesta general durante la ejecución normal de un proceso.
  Ejemplo de una implementación actual que ofrece los beneficios antes mencionados, es el atributo `GeneratedRegexAttribute`, introducido en **.NET 7**, evita la compilación de una expresión regular en tiempo de ejecución, generando código en tiempo de compilación, optimizado, que evalúa las coinidencias, resultando en una mejora drástrica en el rendimiento. Otro ejemplo podría ser el atributo [`LibraryImport`](https://learn.microsoft.com/en-us/dotnet/standard/native-interop/pinvoke-source-generation), que viene a ser un sustituto a `DllImport`, así como también, son ejemplo las técnicas avanzadas que utiliza actualmente Blazor para convertir los templates razor a clases generadas, especializadas en la generación de documentos HTML.
  
2. **Eliminación de código repetivo (Boilerplate)**
  Otro de los beneficios es la automatización de la escritura de código repetitivo y propenso a errores, como podría ser la creación de DTOs, mapeadores de código, o incluso DAOs y funciones de acceso a bases de datos o recursos de red.
  
3. **Modelos de despliegue modernos**
  Quizá una de las ventajas más importantes (al menos para este servidor), es la compatibilidad con tecnologías de optimización modernas como pueden ser la compilación **AOT** ([Ahead-of-Time](https://learn.microsoft.com/en-us/dotnet/core/deploying/native-aot/?tabs=windows%2Cnet8)), o el **Trimming** ([Recorte de ensamblados](https://learn.microsoft.com/en-us/dotnet/core/deploying/trimming/trim-self-contained)). Estas tecnologías son más compatibles con entornos en la nube, móviles, o casos de uso de alto rendimiento y bajo consumo de recursos. En estos casos donde la compatibilidad con reflexión es inexistente, o el rendimiento es primordial, la generación de código permite obtener todo el código necesario durante la compilación, pasando de una simple optimización a un pilar arquitectónico de la estrategia de **.NET** para el futuro.
  
### 1.2 Casos de uso en el ecosistema .NET

Los generadores de código no son un fenómeno aislado, de nicho, sin que actualmente están profundamente integrados en la plataforma **.NET**.

1. **Serializador `System.Text.Json`**
  El serializador **JSON** integrado en .NET es un claro ejemplo de caso de uso. Mediante el uso del atributo `JsonSerializableAttribute` aplicado a una clase parcial que extienda de `JsonSerializerContext`, es posible activar un generador de código que analiza los tipos y produce lógica de serialización y deserialización muy optimizada en tiempo de compilación. Esto tiene como resultado una [mejora del rendimiento de hasta un 40%](https://okyrylchuk.dev/blog/intro-to-serialization-with-source-generation-in-system-text-json/) en el arranque gracias a evitar el uso de la reflexión.

**El generador utiliza dos modos de operación:**
  - **Modo basado en metadatos**: Recolecta de antemano los metadatos necesarios de los tipos, para acelerar la serialización y deserialización.
  - **Modo de optimización de serialización**: Genera el código utilizando `Utf8JsonWriter` directamente, ofreciendo el máximo rendimiento posible de serialización. Este modo es más restrictivo y no soporta todas las opciones de personalización.
  > Más detalles en [Microsoft Learn: serialization/system text json/source generation](https://learn.microsoft.com/en-us/dotnet/standard/serialization/system-text-json/source-generation)
  
2. **ASP.NET Core y Native AOT**
  ASP.NET Core utiliza el generador incorporado `RequestDelegateGenerator`, para hacer que las Minimal APIs sean compatibles con **Native AOT**. Esta característica hace uso de los `interceptors`, de que se tratarán más adelante en este artículo. Pero básicamente, **intercepta** las llamadas a `app.MapGet()` que normalmente dependerían de reflexión, reemplazándolas por lógica precompilada. El producto de esto es un ejecutable nativo y altamente optimizado.
  
3. **Inyección de dependencias**
  Muchos contenedores de Inyección de Dependencias de alto rendimiento ([Pure.DI](https://github.com/DevTeam/Pure.DI), [Injectio](https://github.com/loresoft/Injectio), [Jab](https://github.com/pakrym/jab), [StrongInject](https://github.com/YairHalberstadt/stronginject) [_algunos más activos que otros_]) han adoptado el uso de generadores de código, permitiendo generar el grafo de dependencias durante la compilación además de detectar en esta misma fase, aquellas dependencias que aún no fueron implementadas o que se encuentran incompletas. Esto reduce la probabilidad de recibir excepciones en tiempo de ejecución, y sin mencionar la mejora en el rendimiento.
  
### 1.3 Consideraciones de portabilidad

Al desarrollar un generador de código, se requiere tener en cuenta el entorno en el que se ejecutará.

1. **Framework de destino (Target Framework)**
  Es importante que el proyecto generador tenga como framework de destino `netstandard2.0` para maximizar la compatibilidad con diferentes versiones de **Visual Studio**, **MSBuild**, el **SDK de .NET** e incluso algunos otros IDEs.
  
2. **IDE vs. Compilación en Línea de Comandos**
  El pipeline incremental, así como el sistema de caché (que se tratará más adelante en este artículo), están diseñados principalmente para maximizar la experiencia en un IDE (**Visual Studio**, **Rider**, etc.), ofreciendo una retroalimentación inmediata al desarrollador. En caso de usarse la línea de comandos, este proceso de compilación no será automático y probablemente requiera el desarrollo de un script que mejore esta experiencia. Editores como **Visual Studio Code** y derivados podrían ya contar con soporte integrado mediante las extensiones oficiales de **.NET** y **C#** ([C# Dev Kit](https://marketplace.visualstudio.com/items?itemName=ms-dotnettools.csdevkit) u otras).
  
3. **Entornos multiplataforma**
  El desarrollo en **Unity** u otras plataformas podría requerir configuración adicional para que se reconozcan los generadores como un componente de compilación. Cada cual lo tendrá seguramente documentado para cada caso puntual.
  
###  Evolución de `ISourceGenerator` hacia `IIncrementalGenerator`

En pocas palabras, el uso de la interfaz `ISourceGenerator` no es una opción en absoluto. `IIncrementalGenerator` es la única opción, ya que la anterior se considera obsoleta.

1. **Comparación "arquitectónica": Imperativo vs Declarativo**
  La diferencia entre ambas interfaces representa un cambio significativo en el modelo de programación:
  - `ISourceGenerator`: Expone dos métodos: `Initialize` y `Execute`, combinado con una implementación de `ISyntaxReceiver` o `ISyntaxContextReceiver`. El `ISyntaxReceiver` realiza un recorrido por todos los árboles de sintaxis de una compilación de forma imperativa, recopilando datos de los nodos, posteriormente invoca al método `Execute`, el cual recibe la compilación completa y el receptor poblado para realizar la generación. Como se mencionó, se trata de un modelo imperativo, y además basado en eventos.
  - `IIncrementalGenerator`: Solo contiene el método `Initialize`, dentro del cual el desarrollador escribe de forma declarativa el flujo de transformaciones de datos, en una sitaxis similar a LINQ. Este flujo describe como se trasladan los datos desde la entrada (código fuente u otros archivos adicionales) hasta el código generado.
  
2. **Rendimiento inferior de `ISourceGenerator`**
  En pocas palabras, el método `Execute` de `ISourceGenerator` se activa con cada pulsación o cambio en el proyecto, obligando a la reevaluación de la lógica, lo que resulta en un rendimiento catastrófico del IDE. `IIncrementalGenerator` resuleve este problema, y permite a **Roslyn** usar una técnica de **Memoization** sobre los resultados de cada etapa, lo que aumenta la eficiencia y solo requiere ejecutarse para cambios en la entrada de datos. Además, `IIncrementalGenerator` separa la etapa inicial de comprobación sintáctica, de la más costosa que es la transformación, siendo esta una etapa que implica análisis semántico. Este punto hace posible que el compilador pueda ejecutar el generador en muchos nodos, pero solo invocar la transformación en aquellos que se filtraron en la primera etapa.
  
### Implementación práctica

En esta sección se demuestra la implementación de un generador de código enfocado en registrar repositorios en un contenedor de inyección de dependencias.

1. **Escenario y configuración**
  - **Objetivo**: Crear un generador que encuentre todas las clases concretas en un ensamblado que implementen la interfaz marcadora `IRepository`. El generador creará un método de extensión para `IServiceCollection` que registrará cada una de estas clases en el contenedor de DI con un ciclo de vida **Scoped**.
  - **Configuración**: En el proyecto que se consuma el generador, se definirá una interfaz marcadora `public interface IRepository()`. El generador buscará las clases que implementen esta interfaz.

2. **Construcción del Pipeline del Generador**
  