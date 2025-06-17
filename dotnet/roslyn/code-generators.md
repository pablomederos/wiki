---
title: Metaprogramación con Generadores de código
description: Guia exaustiva sobre la generación de código usando las apis del compilador Roslyn
published: false
date: 2025-06-17T12:46:28.466Z
tags: roslyn, roslyn api, análisis de código, source generators, análisis estático, syntax tree, code analysis, árbol de sintaxis, api de compilador roslyn, .net source generators, code generators, generadores de código
editor: markdown
dateCreated: 2025-06-17T12:46:28.466Z
---



La metaprogramación es la capacidad de un programa de tratar a otros programas (o a sí mismo) como datos. Esto ha permitido la evolución de los frameworks a lo largo de los años. .NET provee múltiples técnicas con este propósito, como la reflexión (runtime reflection), y las plantillas de texto (T4 templates). Sin embargo, ambos enfoques presentan sus inconvenientes introduciendo una penalización en el rendimiento, durante el arranque en frío de la aplicación o durante su ejecución, ya que en el caso de la reflexión, el framework debe analizar el código durante el tiempo de ejecución, lo que conlleva un costo fijo extra de tiempo que no es posible optimizar.

Con la llegada de la plataforma de compilación llamada `Roslyn`, se pasó de una "caja negra" a una plataforma abierta con apis para el análisis y la generación de código. Esto llevó, entre otras cosas, al surgimiento de los **Source Generators**. Se trata de un componente que analiza el código en tiempo de compilación y produce archivos fuente adicionales, que se compilan con el resto del código.

La idea central de este artículo, es entender qué es un generadore de código incremental, cómo este mejora el rendimiento de la aplicación y mejora la relación entre el desarrollador y el código, así como también, presentar al ahora estándar de metaprogramación en tiempo de compilación de C#, para el desarrollo de bibliotecas modernas y de alto rendimiento.


## Generación incremental: Fundamento y aplicación

</br>

### 1.1 Ventajas fundamentales de la generación en tiempo de compilación

</br>

1. **Mejora del rendimiento**
	Como se mencionó anteriormente, ahora en lugar de realizar un análisis durante el tiempo de ejecución, la carga se desplaza al tiempo de compilación, reduciendo así el arranque de las aplicación, y la respuesta general durante la ejecución normal de un proceso.
  Ejemplo de una implementación actual que ofrece los beneficios antes mencionados, es el atributo `GeneratedRegexAttribute`, introducido en **.NET 7**, evita la compilación de una expresión regular en tiempo de ejecución, generando código en tiempo de compilación, optimizado, que evalúa las coinidencias, resultando en una mejora drástrica en el rendimiento. Otro ejemplo podría ser el atributo [`LibraryImport`](https://learn.microsoft.com/en-us/dotnet/standard/native-interop/pinvoke-source-generation), que viene a ser un sustituto a `DllImport`, así como también, son ejemplo las técnicas avanzadas que utiliza actualmente Blazor para convertir los templates razor a clases generadas, especializadas en la generación de documentos HTML.
  
2. Eliminaci