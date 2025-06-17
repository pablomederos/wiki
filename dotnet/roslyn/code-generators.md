---
title: Metaprogramación con Generadores de código
description: Guia exaustiva sobre la generación de código usando las apis del compilador Roslyn
published: false
date: 2025-06-17T14:56:16.301Z
tags: roslyn, roslyn api, análisis de código, source generators, análisis estático, syntax tree, code analysis, árbol de sintaxis, api de compilador roslyn, .net source generators, code generators, generadores de código
editor: markdown
dateCreated: 2025-06-17T12:46:28.466Z
---



La metaprogramación es la capacidad de un programa de tratar a otros programas (o a sí mismo) como datos. Esto ha permitido la evolución de los frameworks a lo largo de los años. .NET provee múltiples técnicas con este propósito, como la reflexión (runtime reflection), y las plantillas de texto (T4 templates). Sin embargo, ambos enfoques presentan sus inconvenientes introduciendo una penalización en el rendimiento, durante el arranque en frío de la aplicación o durante su ejecución, ya que en el caso de la reflexión, el framework debe analizar el código durante el tiempo de ejecución, lo que conlleva un costo fijo extra de tiempo que no es posible optimizar.

Con la llegada de la plataforma de compilación llamada `Roslyn`, se pasó de una "caja negra" a una plataforma abierta con apis para el análisis y la generación de código. Esto llevó, entre otras cosas, al surgimiento de los **Source Generators**. Se trata de un componente que analiza el código en tiempo de compilación y produce archivos fuente adicionales, que se compilan con el resto del código.

La idea central de este artículo, es entender qué es un generadore de código incremental, cómo este mejora el rendimiento de la aplicación y mejora la relación entre el desarrollador y el código, así como también, presentar al ahora estándar de metaprogramación en tiempo de compilación de C#, para el desarrollo de bibliotecas modernas y de alto rendimiento.


## Generación incremental: Fundamento y aplicación

</br>

### 1.1 Ventajas fundamentales de la generación  de código en tiempo de compilación

</br>

1. **Mejora del rendimiento**
	Como se mencionó anteriormente, ahora en lugar de realizar un análisis durante el tiempo de ejecución, la carga se desplaza al tiempo de compilación, reduciendo así el arranque de las aplicación, y la respuesta general durante la ejecución normal de un proceso.
  Ejemplo de una implementación actual que ofrece los beneficios antes mencionados, es el atributo `GeneratedRegexAttribute`, introducido en **.NET 7**, evita la compilación de una expresión regular en tiempo de ejecución, generando código en tiempo de compilación, optimizado, que evalúa las coinidencias, resultando en una mejora drástrica en el rendimiento. Otro ejemplo podría ser el atributo [`LibraryImport`](https://learn.microsoft.com/en-us/dotnet/standard/native-interop/pinvoke-source-generation), que viene a ser un sustituto a `DllImport`, así como también, son ejemplo las técnicas avanzadas que utiliza actualmente Blazor para convertir los templates razor a clases generadas, especializadas en la generación de documentos HTML.
  
2. **Eliminación de código repetivo (Boilerplate)**
  Otro de los beneficios es la automatización de la escritura de código repetitivo y propenso a errores, como podría ser la creación de DTOs, mapeadores de código, o incluso DAOs y funciones de acceso a bases de datos o recursos de red.
  
3. **Modelos de despliegue modernos**
  Quizá una de las ventajas más importantes (al menos para este servidor), es la compatibilidad con tecnologías de optimización modernas como pueden ser la compilación **AOT** ([Ahead-of-Time](https://learn.microsoft.com/en-us/dotnet/core/deploying/native-aot/?tabs=windows%2Cnet8)), o el **Trimming** ([Recorte de ensamblados](https://learn.microsoft.com/en-us/dotnet/core/deploying/trimming/trim-self-contained)). Estas tecnologías son más compatibles con entornos en la nube, móviles, o casos de uso de alto rendimiento y bajo consumo de recursos. En estos casos donde la compatibilidad con reflexión es inexistente, o el rendimiento es primordial, la generación de código permite obtener todo el código necesario durante la compilación, pasando de una simple optimización a un pilar arquitectónico de la estrategia de **.NET** para el futuro.
  
## 1.2 Casos de uso en el ecosistema .NET

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
  Muchos contenedores de Inyección de Dependencias de alto rendimiento ([Pure.DI](https://github.com/DevTeam/Pure.DI), [Injectio](https://github.com/loresoft/Injectio), [Jab](https://github.com/pakrym/jab), [StrongInject](https://github.com/YairHalberstadt/stronginject) [_algunos más activos que otros_]) han adoptado el uso de generadores de código, permitiendo generar el grafo de dependencias durante la compilación además de detectar en esta misma fase, aquellas dependencias que aún no fueron implementadas o que se encuentran incompletas. Esto reduce la posibilidad de recibir excepciones en tiempo de ejecución, y sin mencionar la mejora en el rendimiento.