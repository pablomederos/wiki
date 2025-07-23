---
title: Pipes
description: 
published: false
date: 2025-07-23T01:09:14.186Z
tags: 
editor: markdown
dateCreated: 2025-07-17T18:36:32.654Z
---


## Pipes y su rol en el panorama IPC

IPC son las siglas en inglés para **Inter-Process Communication** o Comunicación entre procesos. Cuando se trata con sistemas, y estos requieren descomponerse en servicios más pequeños o microservicios, se suele optar principalmente por comunicación mediante sockets TCP/IP, una solución que aunque popular y polivalente, no siempre es la más efiente y apropiada para comunicar aplicaciones, especialemente cuando estas se ejecutan localmente o en una red de area local. Y la verdad, es que yo mismo pocas veces me he sentado a pensar si en lugar de intentar maximizar el rendimiento de mis aplicaciones refinando el código que administra la lógica de negocio, también puedo hacerlo utilizando una capa de transporte más apropiada para ese caso puntual del entorno de ejecución.


Los Pipes (tuberías) son una opción destacable dentro del amplio catálogo que ofrece el ecosistema IPC gracias a su rendimiento y facilidad de uso; sin mencionar el hecho de que el comportamiento en .NET es muy similar a los ya ampliamente conocidos *Streams*. Esta facilidad de uso hace que la comunicación mediante pipes sea muy similar a escribir en un archivo o envar datos a través de la red con `StreamReader` y `StreamWriter`. 

## Pipes en .NET

En .NET, todas las clases necesarias para trabajar con Pipes se encuentran en el espacio de nombres `System.IO.Pipes` con una jerarquía de clases suficientemente intuitiva, como se demuestra a continuación:

- `PipeStream`: Es la clase base abstracta de la que parte el resto de implementaciones subyacentes, siendo esta descendiente directa de `System.IO.Stream`. Además contiene todas las funcionalidades comúnes a todos los tipos de Pipes, manejo de búferes, etc..
- `AnonymousPipeServerStream` y `AnonymousPipeClientStream`: Contienen las implementaciones necesarias para crear **Pipes Anónimos**. Este tipo de pipe no tiene una identidad persistente y solo permite comunicación unidireccional entre procesos y subprocesos. Con estas clases se establece un conducto directo de comunicación **Servidor-Cliente** o **Cliente-Servidor** dentro de una jerarquía de procesos.
- `NamedPipeServerStream` y `NamedPipeClientStream`: Al igual que los anteriores permiten comunicación **Servidor-Cliente**/**Cliente-Servidor**, pero esta vez puede ser configurado para que sea bidireccional o unidireccional, en lugar de únicamente unidireccional como sucede con `AnonymousPipe(Server/Client)Stream`. Estas clases contienen las implementaciones necesarias para crear **Pipes Nombrados**, los cuales pueden ser utilizados para habilitar comunicación entre diferentes procesos o subprocesos no relacionados, e incluso a través de una red local.

Algo interesante de mencionar es que la implementación que ofrece .NET es básicamente una abstracción sobre la que ofrece el sistema operativo host, y que permite además que estos Pipes puedan ser utilizados incluso entre aplicaciones desarrolladas en diferentes lenguajes de programación. En sistemas operativos de la familia Unix como pueden ser Linux, Mac, etc., se utilizan los **Unix Domain Sockets** (UDS) como mecanismo de comunicación para ofrecer estas funcionalidad, y en Windows el soporte viene a través de los **Named Pipes File System** (NPFS), lo que aumenta la capacidad de interoperabilidad de las aplicaciones a la vez que se obtiene un muy alto rendimiento.

## Algunos conceptos

Desarrollando algunos de los puntos mencionados anteriormente, se definen a continuación los conceptos necesarios para establecer cualquier comunicación y algunos fundamentos necesarios para entender la finalidad de cada tipo de Pipe.

- **Servidor de Pipe**: Se refiere al proceso encargado de establecer el canal de comunicación mediante las clases con prefijo **ServerStream** (`NamedPipeServerStream` y `AnonymousPipeServerStream`). Una vez iniciado, se pone a la espera de nuevas conexiones.
Cada instancia del servidor puede antender una única conexión, por lo que si se requiere atender a más de un cliente, se deberán crear tantas instancias como conexiones se requieran.
- **Cliente de Pipe**: Este será el proceso que buscará conectarse a un Pipe (servidor), ahora utilizando las clases con prefijo **ClientStream** (`NamedPipeClientStream` y `AnonymousPipeClientStream`).

La diferencia entre ambos tipos de pipes radica en el "cómo` el cliente encuentra al servidor.

- **Pipes Nombrados**: Son los más versátiles, debido a que no requieren una relación entre el proceso cliente y el servidor. Este tipo de Pipes se identifica por un nombre que es único en todo el sistema operativo (o la red). Se pueden iniciar tantas instancias como conexiones se requieran, todas ellas con el mismo nombre de pipe.
- **Pipes Anónimos**: Mucho más restrictivos, debido a que el pipe no cuenta con un nombre que permita el acceso a otros procesos en todo el sistema operativo, sino que que el servidor proporcionará un manejador (**Handle**) al proceso hijo (cliente) como argumento o mediante otros mecanismos disponibles.

Que los pipes nombrados permitan la conexión de varios clientes, no implica que un mensaje enviado a una instancia de `NamedPipeServerStream` sea difundido a todos ellos, sino que esta capacidad de aceptar múltiples conexiones está relacionada con la estrategia de descubrimiento entre procesos. Por eso, el programador deberá utilizar una estrategia apropiada si desea difundir el mensaje a todos los clientes conectados a un pipe.
La implementación y su uso será ejemplificada mediante algunos snippets de código más adelante, pero ahondando más en tema, pasaré a detallar algunos pormenores de cada tipo de Pipe.

## Pipes Anónimos

Este tipo de pipes es el más ligero y con menor sobrecarga IPC disponible en .NET. Es muy útil para casos de uso muy específicos que tienen que ver con comunicacion entre procesos y **sus** subprocesos. Alguas de las características y limitaciones son:

- **Unidireccionalidad**: Esta limitación es estricta y es la más definitiva de un Pipe Anónimo. En el momento de la creación, se especifica la dirección de la comunicación, siendo esta de entrada o salida (`PipeDirection.In` o `PipeDirection.Out`). Esto conlleva a que si se requiere comunicación bidireccional, se deberán crear dos Pipes Anónimos, uno para cada dirección de la comunicación, lo que añade complejidad a la implementación.
Este tipo de pipes es especialmente útil cuando se desea enviar señales a un subproceso, sin exponer el canal de comunicación a otros procesos en el sitema operativo o red.

- **Comunicación local**: Como se mencionó antes, la comunicación está limitada de procesos a subprocesos, lo que implica que el ámbito es estrictamente local.

- **Identificación por Handle**: A diferencia de los **Named Pipes**, los **Anonymous Pipes** carecen de un nombre, por lo que deben generar un identificador único llamado **Handle** y pasarlo al cliente de forma segura, para que este último pueda saber dónde se encuentra el punto de conexión.

- **Comunicación Padre-Hijo**: Todo lo mencionado anteriormente nos lleva a lo siguiente. Esta "herencia" del Handle es estrictamente asegurada por el Sistema Operativo, el cual a nivel de Kernel es capaz de identificar la jerarquía de procesos, y no permite el uso del handle en un proceso que no está relacionado. Una forma habitual de compartir el Handle, es como argumento al iniciar el proceso hijo, y ese es el enfoque que se demostrará más adelante.

### Posibles casos de uso

- **Servidor Proxy**: Un servicio con un diseño similar al de Nginx podría beneficiarse del uso de los pipes anónimos. Nginx utiliza otras formas muy eficientes de comunicación IPC en lugar de pipes anónimos para reducir al mínimo la comunicación IPC, pero su diseño podría ser un ejemplo de caso de uso práctico.
  
  > Nginx utiliza `Signals` y `Shared Memory` para la comunicación IPC, lo que reduce la sobrecarga de comunicación al mínimo necesario.

    Este diseño, ahora implementado sobre pipes, se basaría en un proceso maestro y varios subprocesos workers que reciben señales de cuando deben actualizar su configuración, detenerse o realizar una tarea. En muchos casos esto podría ser más sencillo con Threads y una implementación del patrón Observer, pero un fallo en el código de un hilo podría matar el proceso principal completo si no se maneja correctamente, llevando a la caída de todas las conexiones en curso. En cambio, los pipes anónimos robustecen los sistemas gracias a su diseño desacoplado y reduciendo el riesgo al mínimo.

- **Redirección de flujos estándar (Standard I/O)**: Debido a la necesidad de una comunicación contínua en este caso particular, un proceso podría beneficiarse de leer directamente el **Standard Input/Output** (stdin/stdout) al, por ejemplo: solicitar la conversión de un video mediante `ffmpeg`, y capturar tanto el `stdin` como el `stdout` para leer el progreso de la tarea o capturar posibles fallos.

- **Comunicación simple entre hilos**: Si bien lo mencioné antes como un posible punto débil de diseño, los pipes anónimos pueden facilitar la comunicación entre hilos dentro de un mismo proceso. Aquí vale destacar que en lugar de pasar la cadena del Handle, se puede pasar el objeto `SafePipeHandle` a un nuevo hilo, lo que resulta ser considerablemente más seguro y eficiente. 

- **Tareas simples en segundo plano**: Similar al ejemplo de redirección de **StdIn/Out**, la naturaleza unidireccional de los Pipes Anónimos podría ser suficiente para un escenario **Fire n' Forget**, enviando al proceso hijo la información necesaria para realizar su tarea, y olvidarse. Es decir, dejar que este último haga su trabajo sin que se requiera un monitoreo activo del estado de la tarea.


### Implementación práctica

A continuación, se mostrará un ejemplo muy simplificado de implementación para que pueda ser analizado posteriormente en este artículo. Sin embargo, este código estará disponible en el repositorio que se adjuntará al final de este contenido.

**Proceso Servidor (Padre)**: `Program.cs`

```csharp

using System.Diagnostics;
using System.IO.Pipes;

try
{

    await using var server = new AnonymousPipeServerStream(PipeDirection.Out, HandleInheritability.Inheritable);
    string clientHandle = server.GetClientHandleAsString();
    Console.WriteLine($"Servidor inicializado con Client Handle: {clientHandle}");

    await using StreamWriter writer = new(server);
    writer.AutoFlush = true;

    // El cliente deberá estar compilado antes de iniciar la comunicación
    using var clientProcess = new Process();
    clientProcess.StartInfo.FileName = "../../../../Client/bin/Debug/net8.0/Client";
    clientProcess.StartInfo.Arguments = clientHandle;
    clientProcess.StartInfo.UseShellExecute = false;//
    clientProcess.StartInfo.RedirectStandardOutput = true;
    clientProcess.StartInfo.RedirectStandardError = true;
    
    // Agregar manejadores para capturar la salida del proceso hijo
    clientProcess.OutputDataReceived += (_, e) => {
        if (!string.IsNullOrEmpty(e.Data))
            Console.WriteLine($"[CLIENT OUT]: {e.Data}");
    };
    
    clientProcess.ErrorDataReceived += (_, e) => {
        if (!string.IsNullOrEmpty(e.Data))
            Console.WriteLine($"[CLIENT ERR]: {e.Data}");
    };

    bool started = clientProcess.Start();

    if (!started)
    {
        Console.Error.WriteLine("Proceso cliente no iniciado");
        return;
    }

    clientProcess.BeginOutputReadLine();
    clientProcess.BeginErrorReadLine();

    server.DisposeLocalCopyOfClientHandle();

    while (true)
    {
        string? serverMessage = Console.ReadLine();
        await writer.WriteLineAsync(serverMessage);

        if (serverMessage == "exit")
            break;
    }

    Console.WriteLine("Servidor finalizado");

    if (!clientProcess.WaitForExit(TimeSpan.FromSeconds(3)))
    {
        Console.WriteLine("Forzando el cierre del cliente");
        clientProcess.Kill();
    }
    
}
catch (Exception ex)
{
    Console.Error.WriteLine(ex);
}


```

**Proceso Cliente (Hijo)** - `Program.cs`

```csharp
using System.IO.Pipes;

try
{
    string clientHandle = args[0];
    Console.WriteLine($"Client handle: {clientHandle}");

    await using var client = new AnonymousPipeClientStream(PipeDirection.In, clientHandle);

    if (!client.IsConnected) return;

    Console.WriteLine("Cliente inicializado");

    using StreamReader reader = new(client);

    while (await reader.ReadLineAsync() is { } line)
    {
        if (line == "exit")
        {
            Console.WriteLine("Conexión cerrada");
            break;
        }

        Console.WriteLine($"El servidor dice: {line}");
    }
}
catch (Exception ex)
{
    Console.Error.WriteLine(ex);
}
```

La línea `string? serverMessage = Console.ReadLine();` implica que el servidor esperará la entrada del usuario mediante teclado y enviará el mensaje al cliente usando el Pipe. Tanto en la salida de terminal del Servidor como en la del Cliente, se mostrará el flujo de datos de un proceso al otro.


### Ciclo de vida del Handle


En cierto punto, en el servidor se llama a `server.DisposeLocalCopyOfClientHandle();`. Esto es fundamental en la lógica de sincronización del pipe, y es importante comprender su uso para evitar errores difíciles de depurar.

El Handle es el medio que tiene el cliente  de identificar cuál es su extemo del pipe, ya sea para escritura o lectura (recordando que es una comunicación unidireccional). El sistema operativo tiene un conteo de referencias que utiliza para gestionar el ciclo de vida de los objetos del Kernel, como en este caso los Pipes.

El flujo de eventos es el siguiente:

1. El servidor crea la instancia de `AnonymousPipeServerStream`, resultando esto en un par de Handles en el kenel. Uno de escritura y otro de lectura.
2. Al llamar a `server.GetClientHandleAsString()`, se obtiene una representación del Handle que utilizará el cliente. Como en el ejemplo de código se usó como argumento del servidor `PipeDirection.Out`, entonces `server.GetClientHandleAsString()` devolverá un Handle para lectura. En caso contrario para una configuración de entrada al servidor, `server.GetClientHandleAsString()` devolvería un Handle de escritura.
3. El Handle del cliente se pasa al proceso hijo, quien lo usará para abrir su extremo del pipe. Usamos `HandleInheritability.Inheritable` como argumento del servidor para permitir que un proceso hijo pueda hacer uso del pipe.
4. Si el servidor no llamase a `DisposeLocalCopyOfClientHandle()` el proceso padre mantendría una referencia al extremo del pipe. Esta llamada desvincula al proceso padre de ese Handle, y debe hacerse inmediatamente después de que el proceso hijo haya sido iniciado. Cuando el proceso hijo termina su trabajo libera el Handle de su extremo del pipe, pero desde la perspectiva del sistema operativo, si el servidor no hubiese liberado el Handle previamente, el pipe no podría ser liberado, y por lo tanto, el resultado sería un **deadlock**, con el servidor colgado esperando un evento de finalización del pipe que nunca ocurriría.

Es bueno pensar en la llamada a `server.DisposeLocalCopyOfClientHandle();` como una forma de enviarle al sistema operativo un mensaje de: "Ya entregué el handle al cliente y no soy responsable de ese extremo del pipe".


## Pipes Nombrados

Si bien, como se mencionó antes, los pipes anónimos son especializados para una comunicación simple y local, los *Pipes Nombrados* son una solución que elimina las principales limitaciones de los pines anónimos, agregando flexibilidad y robustez, siendo más apropiados para una amplia variedad de arquitecturas de software.

### Características

- **Acceso por nombre**: La diferencia más significativa es que los pipes nombrados pueden ser descubiertos mediante una cadena de texto usada como nombre. Esto permite desacoplar los proceso, ya que no se requiere una relación padre a hijo ni compartición de Handles. Un pipe puede ser abierto por cualquier otro proceso que conozca el nombre de este.
- **Bidireccionalidad**: Esta es otra diferencia destacable, ya que los pipes nombrados no solo soportan la comunicación unidireccional (`PipeDirection.In` o `PipeDirection.Out`), sino también la comunicación en ambos sentidos del canal mediante la configuración `PipeDirection.InOut`. Claramente, esto simplifica mucho la implementación.
- **Soporte para múltiples clientes**: Un único proceso servidor puede atender a múltiples clientes. Esto es configurable mediante el parámetro `maxNumberOfServerInstances`, que le indica al sistema operativo cuántas conexiones concurrentes pueden existir para un nombre de pipe dado. Si se desea utilizar el límite máximo que permita el sistema se puede optar por utilizar el valor `NamedPipeServerStream.MaxllowedServerInstances`.
  
  > Algo a tener en cuenta, es que cada nueva instancia de la clase `NamedPipeServerStream` es capaz de atender únicamente una conexión, por lo que por cada cliente que se desee atender, se deberá crear una nueva instancia de `NamedPipeServerStream`.

- **Acceso limitado de Red**: La finalidad de los pipes es su uso en la máquina local, no obstante, también es posible utilizarlos a través de la red local agregando el nombre de la máquina remota al iniciar la conexión. Si bien un socket TCP/IP podría ser más recomendable en estos casos, también podría ser viable reutilizar la implementación de pipes para comunicar servicios en local y a través de la red en simultáneo.
- **Seguridad**: En Windows los pipes nombrados siguen las mismas reglas que otros servicios, ciñéndose a las reglas de seguridad del sistema. Es posible aplicar Listas de Control de Acceso (ACLs) a un pipe para limitar el acceso de usuarios y grupos a conectarse, leer o escribir.

### Posibles casos de uso

Al igual que con los pipes anónimos, paso a listar algunos posibles casos de uso para los pipes nombrados, pero solo pretendo echar algo de luz que pueda llevar al lector a encontrar sus propios casos de uso, quizá, más apropiados o variados.

- **Servicios Locales**: Un uso posiblemente útil es enviar comandos a un servicio de larga duración y monitorear el estado. Dicho servicio podría exponer el servidor para que varios otros procesos puedan conectarse y encolar tareas, a la vez que puede enviar notificaciones del estado de las tareas en curso.
- **Comunicación de Procesos no relacionados**: Casi lo mismo que en el punto anterior, pero ahora fomentando el desacoplamiento, desarrollo y despliegue independiente de aplicaciones.
- **Transporte para RPC**: Lo anterior nos lleva a esto, el bajo overhead permite que los pipes nombrados sean un transporte ideal pra frameworks **RPC**.
- **Comunicación entre diferentes Lenguajes**: Esto ya no está limitado a los pipes nombrados, pero al tratarse de una característica del sistema operativo y no exclusiva de .NET, ya sea usando pipes nombrados, o iniciando un proceso como hijo, los pipes son un canal eficaz para estableer comunicación entre aplicaciones desarrolladas en diferentes lenguajes de programación, como *C++*, *Python*, *Go*, etc., y evitar así la sobrecarga que podría suponer una conexión mediante Socket.
  
### Implementación práctica


**Servidor** - `Program.cs`

```csharp
using System.IO.Pipes;

try
{
    // Si hubiesen muchos clientes, lo ideal 
    Console.WriteLine("Configurando el servidor");

    await using NamedPipeServerStream server = new("NamedPipe", PipeDirection.InOut);

    Console.WriteLine("Servidor iniciado");
    await server.WaitForConnectionAsync();

    Console.WriteLine("Conexión con el cliente establecida");

    using StreamReader reader = new(server);
    await using StreamWriter writer = new(server);
    writer.AutoFlush = true;

    // Sync protocol
    // Waiting for the client to be ready 
    if(await reader.ReadLineAsync() == "READY")
        await writer.WriteLineAsync("Bienvenido");


    while (true)
    {
        string? receivedMessage = await reader.ReadLineAsync();
        if (receivedMessage != null)
        {
            if (receivedMessage == "exit")
            {
                await writer.WriteLineAsync("Gracias por la conexión. Bye!");
                Console.WriteLine("Cerrando la conexión");
                break;
            }

            Console.WriteLine(receivedMessage);
            await writer.WriteLineAsync("Mensaje recibido");
        }
    }
}
catch (Exception ex)
{
    Console.WriteLine(ex);
}

```

**Cliente** - `Program.cs`

```csharp
using System.IO.Pipes;

try
{
    Console.WriteLine("Configurando el cliente");
    await using NamedPipeClientStream client = new("NamedPipe");

    await client.ConnectAsync();
    Console.WriteLine("Cliente conectado al servidor");

    using StreamReader reader = new(client);
    await using StreamWriter writer = new(client);
    writer.AutoFlush = true;
    
    // Sync protocol
    // Ready for messaging notification 
    await writer.WriteLineAsync("READY");


    string? firstReceivedMessage = await reader.ReadLineAsync();
    Console.WriteLine($"Conectado con el mensaje: {firstReceivedMessage}");

    while (true)
    {
        string? message = Console.ReadLine();
        await writer.WriteLineAsync(message);

        string? receivedMessage = await reader.ReadLineAsync();
        Console.WriteLine($"El servidor contesta: {receivedMessage}");

        if (message == "exit")
            break;
    }
}
catch (Exception ex)
{
    Console.WriteLine(ex);
}
```

A diferencia del código anterior, este no requiere liberar un Handle manualmente durante el proceso de conexión, y es un claro ejemplo de una comunicación bidireccional.
Una posible sobrecarga para inicializar la instancia del cliente podría ser `NamedPipeClientStream(".", "NamedPipe", PipeDirection.InOut)`, donde `"."` es el nombre de la máquina remota. Un punto se refiere a `localhost`.
En caso de requerir atender a más de un cliente de forma concurrente con el mismo pipe, la sobrecarga de `NamedPipeServerStream` deberá contener también el parámetro `maxNumberOfServerInstances` para cada nueva instancia creada, pero una instancia solo podrá manejar una única conexión, y será necesario crear tantas instancias como conexiones se requieran.

Esto es debido a que un pipe es una conexión **punto a punto** entre el cliente y el servidor. Además, esto implica que una instancia no se puede reutilizar una vez que un cliente se desconecta, ya que resultaría en un `ObjectDisposedException`.



El siguiente es un ejemplo sumamente simplificado de una implementación para múltiples clientes, usando un solo pipe nombrado (múltiples instancias del mismo), pero sirve como ilustración de lo que mencioné anteriormente:

```csharp
using System;
using System.IO;
using System.IO.Pipes;
using System.Threading;
using System.Threading.Tasks;

class ConcurrentNamedPipeServer
{
    private const int MaxInstances = 10;
    private const string PipeName = "concurrent-pipe";

    static async Task Main(string args)
    {
        int clientId = 0;

        // Bucle infinito para aceptar clientes continuamente.
        while (true)
        {
            try
            {
                var server = new NamedPipeServerStream(
                    PipeName,
                    PipeDirection.InOut,
                    MaxInstances, // Número máximo de instancias permitidas.
                    PipeTransmissionMode.Byte,
                    PipeOptions.Asynchronous);

                Console.WriteLine($"({Thread.CurrentThread.ManagedThreadId}) Esperando conexión de cliente...");
                
                await server.WaitForConnectionAsync();
                
                int currentId = Interlocked.Increment(ref clientId);
                Console.WriteLine($"Cliente #{currentId} conectado.");

                // Lanzar una nueva tarea para manejar la comunicación con este cliente,
                // para no bloquear el bucle principal de aceptación.
                _ = Task.Run(() => HandleClient(server, currentId));
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error en el bucle del servidor: {ex.Message}");
            }
        }
    }

    static async Task HandleClient(NamedPipeServerStream stream, int clientId)
    {
        Console.WriteLine($"({Thread.CurrentThread.ManagedThreadId}) Manejando cliente #{clientId}.");
        await using (stream)
        await using (var writer = new StreamWriter(stream) { AutoFlush = true })
        {
            using var reader = new StreamReader(stream);

            try
            {
                await writer.WriteLineAsync($"Bienvenido, cliente #{clientId}!");

                string line;
                while ((line = await reader.ReadLineAsync())!= null)
                {
                    Console.WriteLine($"Cliente #{clientId} dice: {line}");
                    if (line.Equals("exit", StringComparison.OrdinalIgnoreCase))
                    {
                        break;
                    }
                    await writer.WriteLineAsync($"Eco: {line}");
                }
            }
            catch (IOException)
            {
                Console.WriteLine($"Cliente #{clientId} se ha desconectado abruptamente.");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error manejando cliente #{clientId}: {ex.Message}");
            }

            Console.WriteLine($"Comunicación con cliente #{clientId} finalizada.");
        }
    }
}
```

### Algunos puntos importantes

1. **Modo de transmisión**: Los pipes operan en modo Byte por defecto (`PipeTransmissionMode.Byte`) para maximizar la compatibilidad multiplataforma. Esto implica que los datos se tratan como un flujo contínuo de bytes entre los extremos del pipe, por lo que el programador deberá establecer un protocolo para indicar al otro extremo del pipe cuando termina un mensaje y cuando empieza otro. Usualmente esto se evita utilizando un *StreamReader/StreamWriter* encima del pipe que ya tiene un "protocolo" implícito basado en acumular el flujo de datos en un búfer hasta encontrar un caracter de finalización de línea (`\n` o `\r\n`). No obstante, también se puede configurar el modo `PipeTransmissionMode.Message`, únicamente soportado por Windows, en el que cada operación de escritura será tratada como un mensaje atómico. Esto, como se mencionó antes, evita al desarrollador implementar una lógica de "framing" para que el otro extremo del pipe pueda determinar cuando termina un mensaje y cuando empieza el siguiente.

**Modo Byte**:
```csharp

// Servidor
class ServidorModoBytes
{
    public static void IniciarServidor()
    {
        using var server = new NamedPipeServerStream(
            "TestBytes",
            PipeDirection.InOut,
            1,
            PipeTransmissionMode.Byte);

        server.WaitForConnection();
        
        // Necesitas implementar tu protocolo de mensajes
        var reader = new BinaryReader(server);
        var writer = new BinaryWriter(server);
        
        while (server.IsConnected)
        {
            try
            {
                // Leer longitud del mensaje primero
                int longitud = reader.ReadInt32();
                
                // Leer el mensaje completo
                byte[] mensaje = reader.ReadBytes(longitud);
                
                Console.WriteLine($"Mensaje recibido: {Encoding.UTF8.GetString(mensaje)}");
                
                // Responder
                var respuesta = Encoding.UTF8.GetBytes("Mensaje procesado");
                writer.Write(respuesta.Length);
                writer.Write(respuesta);
                writer.Flush();
            }
            catch (EndOfStreamException)
            {
                break;
            }
        }
    }
}

// Cliente
class ClienteModoBytes
{
    public static void ConectarCliente()
    {
        using var client = new NamedPipeClientStream(".", "TestBytes", PipeDirection.InOut);
        client.Connect();
        
        var writer = new BinaryWriter(client);
        var reader = new BinaryReader(client);
        
        // Enviar mensaje con protocolo de longitud
        var mensaje = Encoding.UTF8.GetBytes("Hola servidor!");
        writer.Write(mensaje.Length); // Enviar longitud primero
        writer.Write(mensaje);        // Enviar datos
        writer.Flush();
        
        // Leer respuesta
        int longitudRespuesta = reader.ReadInt32();
        byte[] respuesta = reader.ReadBytes(longitudRespuesta);
        Console.WriteLine($"Respuesta: {Encoding.UTF8.GetString(respuesta)}");
    }
}
```

**Modo Message (Solo Windows)**:
```csharp
// Servidor - Modo Message
class ServidorModoMensajes
{
    public static void IniciarServidor()
    {
        using var server = new NamedPipeServerStream(
            "TestMessages",
            PipeDirection.InOut,
            1,
            PipeTransmissionMode.Message); // Solo en Windows

        server.WaitForConnection();
        
        byte[] buffer = new byte[1024];
        
        while (server.IsConnected)
        {
            try
            {
                // Cada Read() obtiene un mensaje completo
                int bytesLeidos = server.Read(buffer, 0, buffer.Length);
                
                if (bytesLeidos > 0)
                {
                    string mensaje = Encoding.UTF8.GetString(buffer, 0, bytesLeidos);
                    Console.WriteLine($"Mensaje recibido: {mensaje}");
                    
                    // Responder - cada Write es un mensaje completo
                    byte[] respuesta = Encoding.UTF8.GetBytes("Mensaje procesado");
                    server.Write(respuesta, 0, respuesta.Length);
                }
            }
            catch (IOException)
            {
                break;
            }
        }
    }
}

// Cliente
class ClienteModoMensajes
{
    public static void ConectarCliente()
    {
        using var client = new NamedPipeClientStream(".", "TestMessages", PipeDirection.InOut);
        client.Connect();
        
        // Cada Write es un mensaje completo
        byte[] mensaje = Encoding.UTF8.GetBytes("Hola servidor!");
        client.Write(mensaje, 0, mensaje.Length);
        
        // Cada Read obtiene un mensaje completo
        byte[] buffer = new byte[1024];
        int bytesLeidos = client.Read(buffer, 0, buffer.Length);
        
        string respuesta = Encoding.UTF8.GetString(buffer, 0, bytesLeidos);
        Console.WriteLine($"Respuesta: {respuesta}");
    }
}
```


2. **Seguridad**: Como se mencionó antes, los pipes soportan la aplicación de **Listas de Control de Acceso** (ACLs). Esto también es una característica dependente de la plataforma, y actualmente solo es soportada en Windows.
   Esta característica permite proteger un servicio en un entorno multiusuario mediante la clase `PipeSecurity`, a través de reglas de acceso de forma programática. La idea es crear una instancia de `PipeSecurity` y agregar una o más `PipeAccessRule` que especifiquen un usuario o grupo, mediante una `IdentityReference`. 
   `IdentityReference` contendrá los derechos que se le conceden (`PipeAccessRights`), y si se permite o deniega el acceso (`AccessControlType`).

**Ejemplo**: 
```csharp
using System;
using System.IO.Pipes;
using System.Security.AccessControl;
using System.Security.Principal;

class Program
{
    static void Main()
    {
        var pipeSecurity = new PipeSecurity();
        
        // Administradores: Control total
        pipeSecurity.AddAccessRule(new PipeAccessRule(
            new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid, null),
            PipeAccessRights.FullControl,
            AccessControlType.Allow));
        
        // Power Users: Lectura y escritura
        pipeSecurity.AddAccessRule(new PipeAccessRule(
            new SecurityIdentifier(WellKnownSidType.BuiltinPowerUsersSid, null),
            PipeAccessRights.ReadWrite,
            AccessControlType.Allow));
        
        // Usuarios normales: Solo lectura
        pipeSecurity.AddAccessRule(new PipeAccessRule(
            new SecurityIdentifier(WellKnownSidType.BuiltinUsersSid, null),
            PipeAccessRights.Read,
            AccessControlType.Allow));
        
        // Grupo personalizado de la empresa
        try
        {
            var grupoAplicacion = new NTAccount("EMPRESA\\GrupoAplicacion");
            pipeSecurity.AddAccessRule(new PipeAccessRule(
                grupoAplicacion,
                PipeAccessRights.ReadWrite,
                AccessControlType.Allow));
        }
        catch (Exception ex)
        {
            Console.WriteLine($"No se pudo configurar grupo personalizado: {ex.Message}");
        }
        
        // Denegar explícitamente a invitados
        pipeSecurity.AddAccessRule(new PipeAccessRule(
            new SecurityIdentifier(WellKnownSidType.BuiltinGuestsSid, null),
            PipeAccessRights.FullControl,
            AccessControlType.Deny));

        using (var server = new NamedPipeServerStream(
            "PipeConRoles",
            PipeDirection.InOut,
            1,
            PipeTransmissionMode.Byte,
            PipeOptions.None,
            1024,
            1024,
            pipeSecurity))
        {
            Console.WriteLine("Servidor iniciado con control de acceso por roles...");
            server.WaitForConnection();
            Console.WriteLine("Cliente conectado con permisos adecuados.");
        }
    }
}
```

## Integración con Frameworks Avanzados

El uso directo de pipes mediante `System.IO.Pipes` es una herramienta excelentemente útil para transporte de bajo nivel, y esto es una gran ventaja para su uso como transporte subyacente de alto rendimiento para frameworks más abstractos.
ASP.NET Core y gRPC se beneficiam considerablemente de los pipes nombrados para optimizar la comunicación IPC separando la capa de aplicación de la capa de transporte.

### Pipes como transporte de Alto Rendimiento

Una ventaja arquitectónica inmensa puede ser el poder intercambiar la capa de transporte sin alterar la lógica de la aplicación, y diseñar una aplicación para operar en diferentes topologías de despliegue.
Un microservicio que se despliegue en contenedores podría aprovechar la comunicación TCP/IP, mientras que para pruebas de integración o escenarios de alto rendimiento/recursos limitados, los pipes podrían ser una mejor opción. Kestrel (Servidor web en ASP.NET Core) permite aprovechar esta flexibilidad optimizando el rendimiento sin rescribir la lógica de negocio.

- ### ASP.NET Core con Pipes Nombrados
  ASP.NET Core, a través del servidor web Kestrel, es capaz de escuchar peticions HTTP no solo en puertos TCP, sino también a través de pipes nombrados, exponiendo de este modo una API RESTful completa (controladores, middleware, inyección de dependencias, etc.), a través de un canal IPC local, seguro, de alto rendimiento y sin abrir puertos de red en la máquina.

#### Ejemplo:

- **Servidor**

```csharp
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Server.Kestrel.Core;

var builder = WebApplication.CreateBuilder(args);

// Configución de Kestrel
builder.WebHost.ConfigureKestrel(options =>
{
    options.ListenNamedPipe("mi-api-pipe", listenOptions =>
    {
        // HTTP/2 es requerido si se planea usar gRPC sobre este pipe.
        // Para REST simple, HTTP/1.1 es suficiente.
        listenOptions.Protocols = HttpProtocols.Http1AndHttp2;
    });
});

builder.Services.AddControllers();
var app = builder.Build();

app.MapGet("/", () => "Servidor ASP.NET Core escuchando en un pipe nombrado!");
app.MapControllers();

app.Run();
```

- **Cliente**

```csharp
using System;
using System.IO;
using System.IO.Pipes;
using System.Net;
using System.Net.Http;
using System.Net.Sockets;
using System.Threading;
using System.Threading.Tasks;

public class NamedPipeHttpClient
{
    public static async Task RunClientAsync()
    {
        const string pipeName = "mi-api-pipe";

        // Crear un SocketsHttpHandler personalizado.
        var handler = new SocketsHttpHandler
        {
            // El ConnectCallback anula la lógica de conexión TCP estándar.
            ConnectCallback = async (context, cancellationToken) =>
            {
                var pipeStream = new NamedPipeClientStream(
                    serverName: ".",
                    pipeName: pipeName,
                    direction: PipeDirection.InOut,
                    options: PipeOptions.Asynchronous);

                try
                {
                    await pipeStream.ConnectAsync(cancellationToken);
                    return pipeStream;
                }
                catch
                {
                    pipeStream.Dispose();
                    throw;
                }
            }
        };

        var httpClient = new HttpClient(handler);

        // El host en la URI es arbitrario, ya que la conexión se redirige al pipe.
        var response = await httpClient.GetAsync("http://localhost/WeatherForecast");

        if (response.IsSuccessStatusCode)
        {
            var content = await response.Content.ReadAsStringAsync();
            Console.WriteLine("Respuesta del servidor a través del pipe:");
            Console.WriteLine(content);
        }
        else
        {
            Console.WriteLine($"Error: {response.StatusCode}");
        }
    }
}
```

- ### RPC tipado con StreamJsonRpc

Uno de mis usos favoritos es el que se le da en la herramienta **C# Dev Kit** para **Visual Studio Code** para la comunicación entre la extensión escrita en JavaScript/TypeScript y el servidor de lenguaje Roslyn escrito en C#.
Muchos escenarios no requieren la pila completa de ASP.NET Core, por lo que el uso de la librería `StreamJsonRpc` ofrece una solución eficiente y ligera para realizar llamadas a procedimientos remotos (RPC) sobre cualquier `Stream` de datos. Esto resulta en un sistema de comunicación fuertemente tipado, de baja latencia y con un mínimo de configuración.
Esta genialidad vuelve al punto en la introducción de este artículo, abriendo las puertas a otras formas más eficientes y apropiadas para resolver cuestiones relacionadas con la comunicación IPC local.

  #### Ejemplo:

  - **Shared Kernel**
  ```csharp
  public interface ICalculator
  {
      Task<int> Add(int a, int b);
  }
  ```

  -  **Servidor**:

  ```csharp
  using System;
  using System.IO.Pipes;
  using System.Threading.Tasks;
  using StreamJsonRpc;

  public class RpcServer
  {
      public static async Task StartServerAsync()
      {
          await using var pipeServer = new NamedPipeServerStream("jsonrpc-pipe", PipeDirection.InOut);
          await pipeServer.WaitForConnectionAsync();
          using var jsonRpc = JsonRpc.Attach(pipeServer, new CalculatorService());
          
          Console.WriteLine("Servidor RPC conectado. Esperando llamadas...");
          
          // Esperar a que la conexión se cierre.
          await jsonRpc.Completion;
      }
  }
  public class CalculatorService : ICalculator
  {
      public Task<int> Add(int a, int b)
      {
          return Task.FromResult(a + b);
      }
  }
  ```

  - **Cliente**:
  ```csharp
  using System;
  using System.IO.Pipes;
  using System.Threading.Tasks;
  using StreamJsonRpc;

  public class RpcClient
  {
      public static async Task StartClientAsync()
      {
          await using var pipeClient = new NamedPipeClientStream(".", "jsonrpc-pipe", PipeDirection.InOut);
          await pipeClient.ConnectAsync();

          using var jsonRpc = JsonRpc.Attach(pipeClient);
          var calculator = jsonRpc.Attach<ICalculator>();

          int result = await calculator.Add(5, 3);
          Console.WriteLine($"Resultado de la llamada RPC: 5 + 3 = {result}");
      }
  }
  ```

- ### gRPC con PipesNombrados
  gRPC es el framework moderno de Google para RPC de alto rendmiento, y, el sucesor espiritual de WCF para ASP.NET Core. Por defecto, utiliza HTTP/2 sobre sokets TCP como transporte, lo que introduce una sobrecarga innecesaria, como vimos anteriormente, cuando el cliente y el servidor se ejecutan en la misma máquina.
  La respuesta: gRPC en ASP.NET también puede configurarse para usar pipes nombrados como transporte. Claramente esto combina la facilidad de uso de y contratos tipados de gRPC, con el alto rendimiento de los pipes.

  #### Ejemplo:
  - **Servidor**

    ```csharp
    builder.WebHost.ConfigureKestrel(options =>
    {
        // Igual que antes con el API RESTful
        options.ListenNamedPipe("grpc-pipe", listenOptions =>
        {
            listenOptions.Protocols = HttpProtocols.Http2;
        });
    });

    builder.Services.AddGrpc();
    var app = builder.Build();
    app.MapGrpcService<GreeterService>();
    app.Run();
    ```

  - **Cliente**

    ```csharp
    using System;
    using System.IO.Pipes;
    using System.Net.Sockets;
    using System.Threading.Tasks;
    using Grpc.Net.Client;

    public class GrpcPipeClient
    {
        public static async Task RunClientAsync()
        {
            var connectionFactory = new NamedPipesConnectionFactory("grpc-pipe");
            var socketsHttpHandler = new SocketsHttpHandler
            {
                ConnectCallback = connectionFactory.ConnectAsync
            };

            // Crear el canal gRPC apuntando a un host ficticio y usando el handler personalizado.
            var channel = GrpcChannel.ForAddress("http://localhost", new GrpcChannelOptions
            {
                HttpHandler = socketsHttpHandler
            });

            var client = new Greeter.GreeterClient(channel);
            var reply = await client.SayHelloAsync(new HelloRequest { Name = "Cliente gRPC sobre Pipe" });

            Console.WriteLine("Respuesta de gRPC: " + reply.Message);
        }
    }

    // Clase auxiliar para gestionar la conexión al pipe.
    public class NamedPipesConnectionFactory
    {
        private readonly string _pipeName;

        public NamedPipesConnectionFactory(string pipeName)
        {
            _pipeName = pipeName;
        }

        public async ValueTask<Stream> ConnectAsync(SocketsHttpConnectionContext _, CancellationToken cancellationToken = default)
        {
            var clientStream = new NamedPipeClientStream(
                serverName: ".",
                pipeName: _pipeName,
                direction: PipeDirection.InOut,
                options: PipeOptions.Asynchronous);

            try
            {
                await clientStream.ConnectAsync(cancellationToken);
                return clientStream;
            }
            catch
            {
                clientStream.Dispose();
                throw;
            }
        }
    }
    ```

## Pipes frente a Otros Mecanismos de IPC en.NET

Elegir un mecanismo IPC es siempre una decisión arquitectónica importante que tiene que ver más con la funcionalidad, sino que implica un compromiso entre rendimiento y complejidad.
Paso a comparar los Pipes con otras alternativas populares en el catálogo de .NET con otras alternativas que estrán disponibles en otros artículos de esta Wiki:

### Pipes vs Sockets

- **Rendimiento**: Cuando se trata de comunicación local o dentro de la misma máquina, los pipes (y su equivalente en Linux UDS) son significativamente más rápidos que los sockets TCP/IP. Esto se debe a que los pipes evitan buena parte de la pila de red del sistema operativo. Esto implica no construir cabeceras TCP, calcular checksums, handshake de 3 vías, etc., siendo esto reemplazado por una comunicación de datos más directa a través de los búferes del kernel.
- **Flexibilidad y usos**: Indudablemente, los Sockets TCP/IP tienen la ventaja en este campo, ya que permiten la intercomunicación de procesos en diferentes máquinas a través de la red. Si bien los pipes nombrados también soportan comunicación en red LAN, no están diseñados para una comunicación robusta de red.
- **Complejidad**: Ya vimos antes que los pipes son muy fáciles de configurar, siendo solo necesario conocer el nombre del pipe. Esto evita la gestión de direcciones IP y puertos u otro conflicto relacionado con la disponibilidad de estos.
- **Conclusión**: Los pipes son siempre la mejor elección cuando de comunicación IPC local se trata. Si la comunicación irá más allá de los límites de la máquina, los Sockets TCP/IP son la opción más adecuada.

### Pipes vs Memory Mapped Files

Esta comparación parecerá quizá extraña, dado que se trata de dos paradigmas completamente diferentes, sin embargo, conociendo todas las posibilidades en la "navaja suiza" del programador, es posible tomar una mejor desición cuando de aprovechar mejor cada recurso se trata.

- **Paradigma**: Los pipes utilizan un enfoque de **compartir mediante comunicación**. Los datos se copian desde la memoria de un proceso, hacia un búfer del kernel, y de ahí al especio de memoria del siguiente proceso. No obstante, los **Memory Mapped Files** utilizan un enfoque de **comunicacar mediante compartición**. Esto es, una región de la memoria se mapea en el espacio de memoria de direcciones virtuales de varios procesos, lo que evita la copia de datos, operando todos sobre la misma memoria.
- **Rendimiento**: Por lo dicho en el punto anterior, los **Memory Mapped Files** ofrecen el mayor rendimiento cuando se trata de compartir grandes volúmenes de datos en la misma máquina, ya que evitan la cipia de datos entre espacios de memoria.
- **Sincronización y complejidad**: Debido a que los **Memory Mapped Files** no cuentan con un mecanismo inherente para la sincronización, el desarrollador es el responsable de hacer este trabajo. Por el contrario, un pipe se bloqueará en una operación de lectura hasta que hayan datos disponibles. Esta cerencia en cuanto a los **Memory Mapped Files** aumenta la complejidad, y expone los datos condiciones de carrera, corrupción u otros errores difíciles de depurar.
- **Conclusión**: Cuando el rendimiento sea una prioridad incuestionable, los **Memory Mapped Files** son la opción más adecuada, ya que permiten el acceso concurrente y de alta velocidad a grandes volúmenes de datos (por ejemplo, un frame de video, una matriz de datos, o cualquier otro volúmen importante de datos que no conviene duplicar en memoria o requiera acceso inmediato entre diferentes procesos). Sin embargo, los pipes aún ofrecen un rendimiento excelente y son una mejor opción cuando se requiere de flujo secuencial y sincronización implícita.

### Pipes vs gRPC

No parece justo hacer esta comparativa, ya que los pipes son un mecanismo de transporte de bajo nivel, y **gRPC** es un framework RPC de alto nivel. Pero como vimos antes, la posiblidad de usar o no pipes en el servidor puede ofrecer una ventaja importante en cuanto a seguridad y rendimiento, ya sea que se usen en conjunto con **gRPC** o separados.

- **Facilidad de uso**: En cuanto a su uso por separado, **gRPC** es mucho más fácil de usar y mantener. Este cuenta con contratos `.proto`, y generación de código, lo que elimina un sin fin de errores manuales de serialización/deserialización. Por eso, **gRPC** es mucho menos propenso a errores que construir un protocolo personalizado sobre un pipe crudo.
- **Rendimiento**: Se mencionó antes en este artículo, y la verdad es que **gRPC** sobre TCP/IP añade una sobrecarga de red innecesaria en procesos que se ejecutan en la misma máquina en comparación con el uso directo de pipes. La solución es sin dudas, la combinación de ambos, lo que ofrece el mayor rendimiento de los pipes y la facilidad de uso de **gRPC**.
- **Conclusión**: Evitar construir protocolos complejos manualmente sobre pipes sería ideal, pero claramente para comunicación IPC local los pipes son la mejor para algunos casos menos complejos. **gRPC** es más adecuado para construir APIs IPC robustas, mantenibles y escalables, aunque aún mejor es configurar los pipes nombrados como transporte de este para maximizar el rendimiento.

### Pipes vs Colas de Mensajes

Si hice mención de **gRPC** antes, no puedo dejar atrás otras opciones de comunicación como **RabbitMQ**, **MSMQ**, etc.

- **Acomplamiento**: Los pipes establecen un acoplamiento temporal y directo entre el cliente y el servidor, lo que implica que se requiere que ambos estén ejecutándose en simultáneo para que la comunicación se establezca. Las colas de mensajes desacoplan completamente al productor y consumidor, por lo que los mensajes se pueden enviar independientemente de si ambos procesos están activos o no. 
- **Fiabilidad**: Las colas de mensajes ofrecen persistencia de los mensajes y garantías de entrega, lo las hace ideales para escenarios que en los que un sistema no se puede permitir la pérdida de mensajes. En su lugar, los pipes no lo hacen, y si el cliente no está a la escucha en ese momento, los mensajes se perderán.
- **Escalabilidad**: Las colas de mensajes están pensadas para sistemas distribuidos y soportan patrones avanzados de comunicación, enrutamiento de mensajes y balanceo de carga entre múltiples consumidores que leen la misma cola. Los pipes en su lugar,son un mecanismo punto a punto.
- **Conclusión**: Aquí el modelo de despliegue y arquitectura de la solución tendrán el papel central en la toma de desiciones. Los pipes siguen siendo la solución ideal para la comunicación directa, de baja latencia y en tiempo real entre procesos locales, pero maximizan el acoplamiento. Las colas de mensajes son ideales cuando se requiere comunicación asíncrona, desacoplada y fiable. Y seguro, son la elección indiscutibles en sistemas distribuidos, basados en eventos y que requieren resiliencia ante fallos.

Soy fan del rendimiento, pero en cuanto a comunicación IPC, no es una cuestión de benchmarks y preferencias únicamente, sino también de requisitos de un sistema y el compromiso entre flexibilidad, fiablidad y escalabilidad.

### Tabla comparativa

Para sintetizar un poco lo anterior, dejo esta tabla comparativa como referencia, que pienso que podría ayudar a tomar mejores decisiones cuando se deba elejir la mejor herramienta para resolver un problema.


|Criterio|Memory-Mapped Files|Pipes (Named/UDS)|Sockets (TCP/IP)|gRPC (sobre TCP)|Colas de Mensajes|
|:---:|:---:|:---:|:---:|:---:|:---:|
|**Rendimiento Local**|	★★★★★ (El más alto)| ★★★★☆ (Muy Alto)|★★★☆☆ (Overhead de red)|★★★☆☆ (Bueno)|★☆☆☆☆ (Más Lento)|
|**Paradigma**|Memoria Compartida|Stream de Mensajes|Stream de Red|RPC Tipado|Mensajería Asíncrona|
|**Complejidad**|★★★★★ (Muy Alta, sync manual)|★★☆☆☆ (Baja/Moderada)|★★★☆☆ (Moderada)|★☆☆☆☆ (La más baja)|★★★☆☆ (Config. de broker)|
|**Acoplamiento**|Fuerte (Datos)|Fuerte (Temporal)|Fuerte (Temporal)|Fuerte (Contrato)|Débil (Total)|
|**Uso en Red**|No|Limitado (LAN)|Sí (Nativo)|Sí (Nativo)|Sí (Nativo)|
|**Ideal Para...**|Compartir grandes datasets, estado compartido.|	Servicios locales, API de IPC, transporte para RPC.|Comunicación cliente-servidor estándar en red.|APIs de microservicios, comunicación entre lenguajes.|Sistemas distribuidos, resiliencia, tareas en background.|

## Conclusión final

Aunque tradicionalmente vistos como anticuados, los pipes en C# y .NET son herramientas modernas y potentes para la comunicación local de alto rendimiento, esenciales para la Comunicación Entre Procesos (IPC). Su evolución en .NET, con implementación multiplataforma e integración en extensiones y con frameworks como ASP.NET Core y gRPC, subraya su relevancia. Para un arquitecto de software .NET, comprender a fondo los pipes y elegir el mecanismo IPC adecuado (anónimo, nombrado, MMF o gRPC) es crucial para diseñar sistemas eficientes, robustos y escalables.