---
title: Pipes
description: A look at the benefits and features that make Pipes in .NET an excellent tool in the IPC landscape.
published: true
date: 2025-07-23T15:28:08.122Z
tags: dotnet, ipc, pipes, grpc, grpc pipes, inter-process communication, anonymous pipes, named pipes
editor: markdown
dateCreated: 2025-07-23T15:28:08.122Z
---

I. [Pipes and their role in the IPC landscape](#texto-ancla1)
II. [Pipes in .NET](#texto-ancla2)
III. [Some concepts](#texto-ancla3)
IV. [Anonymous Pipes](#texto-ancla4)

  - A. [Possible use cases](#texto-ancla5)
  - B. [Practical implementation](#texto-ancla6)
  - C. [Handle lifecycle](#texto-ancla7)
    V. [Named Pipes](#texto-ancla8)
  - A. [Characteristics](#texto-ancla9)
  - B. [Possible use cases](#texto-ancla10)
  - C. [Practical implementation](#texto-ancla11)

V. [Some important points](#texto-ancla12)
VI. [Integration with Advanced Frameworks](#texto-ancla13)

  - A. [Pipes as High-Performance Transport](#texto-ancla14)
      - 1.  [ASP.NET Core with Named Pipes](#texto-ancla15)
      - 2.  [Typed RPC with StreamJsonRpc](#texto-ancla16)
      - 3.  [gRPC with Named Pipes](#texto-ancla17)

VII. [Pipes vs. Other IPC Mechanisms in .NET](#texto-ancla18)

  - A. [Pipes vs. Sockets](#texto-ancla19)
  - B. [Pipes vs. Memory Mapped Files](#texto-ancla20)
  - C. [Pipes vs. gRPC](#texto-ancla21)
  - D. [Pipes vs. Message Queues](#texto-ancla22)
  - E. [Comparative table](#texto-ancla23)

VIII. [Final conclusion](#texto-ancla24)

<div id="texto-ancla1"/>

## I. Pipes and their role in the IPC landscape

IPC stands for **Inter-Process Communication**. When dealing with systems that need to be broken down into smaller services or microservices, the primary choice is often communication via TCP/IP sockets, a solution that, although popular and versatile, is not always the most efficient and appropriate for communicating between applications, especially when they run locally or on a local area network. And the truth is, I myself have rarely sat down to think if, instead of trying to maximize the performance of my applications by refining the business logic code, I could also do so by using a more appropriate transport layer for that specific execution environment.

Pipes are a noteworthy option within the broad catalog offered by the IPC ecosystem thanks to their performance and ease of use; not to mention the fact that their behavior in .NET is very similar to the already widely known *Streams*. This ease of use makes communication via pipes very similar to writing to a file or sending data over the network with `StreamReader` and `StreamWriter`.

<div id="texto-ancla2"/>

## II. Pipes in .NET

In .NET, all the necessary classes for working with Pipes are found in the `System.IO.Pipes` namespace with a sufficiently intuitive class hierarchy, as shown below:

  - `PipeStream`: This is the abstract base class from which the other underlying implementations derive, being a direct descendant of `System.IO.Stream`. It also contains all the common functionalities for all types of Pipes, buffer management, etc.
  - `AnonymousPipeServerStream` and `AnonymousPipeClientStream`: These contain the necessary implementations to create **Anonymous Pipes**. This type of pipe does not have a persistent identity and only allows unidirectional communication between processes and subprocesses. With these classes, a direct communication channel **Server-Client** or **Client-Server** is established within a process hierarchy.
  - `NamedPipeServerStream` and `NamedPipeClientStream`: Like the previous ones, they allow **Server-Client**/**Client-Server** communication, but this time it can be configured to be bidirectional or unidirectional, instead of only unidirectional as is the case with `AnonymousPipe(Server/Client)Stream`. These classes contain the necessary implementations to create **Named Pipes**, which can be used to enable communication between different unrelated processes or subprocesses, and even across a local network.

Something interesting to mention is that the implementation offered by .NET is basically an abstraction over what the host operating system provides, and it also allows these Pipes to be used even between applications developed in different programming languages. In Unix-family operating systems such as Linux, Mac, etc., **Unix Domain Sockets** (UDS) are used as the communication mechanism to offer this functionality, and in Windows, support comes through the **Named Pipes File System** (NPFS), which increases the interoperability capacity of applications while achieving very high performance.

<div id="texto-ancla3"/>

## III. Some concepts

Expanding on some of the points mentioned earlier, the necessary concepts to establish any communication and some fundamentals needed to understand the purpose of each type of Pipe are defined below.

  - **Pipe Server**: Refers to the process responsible for establishing the communication channel using the classes with the **ServerStream** prefix (`NamedPipeServerStream` and `AnonymousPipeServerStream`). Once started, it waits for new connections.
    Each server instance can handle a single connection, so if more than one client needs to be served, as many instances as required connections must be created.
  - **Pipe Client**: This will be the process that seeks to connect to a Pipe (server), now using the classes with the **ClientStream** prefix (`NamedPipeClientStream` and `AnonymousPipeClientStream`).

The difference between both types of pipes lies in "how" the client finds the server.

  - **Named Pipes**: These are the most versatile, as they do not require a relationship between the client and server processes. This type of Pipe is identified by a name that is unique throughout the operating system (or network). As many instances as required connections can be started, all with the same pipe name.
  - **Anonymous Pipes**: Much more restrictive, because the pipe does not have a name that allows access by other processes throughout the operating system; instead, the server will provide a handler (**Handle**) to the child process (client) as an argument or through other available mechanisms.

The fact that named pipes allow multiple clients to connect does not mean that a message sent to an instance of `NamedPipeServerStream` is broadcast to all of them, but rather that this ability to accept multiple connections is related to the discovery strategy between processes. Therefore, the programmer must use an appropriate strategy if they wish to broadcast the message to all clients connected to a pipe.
The implementation and its use will be exemplified with some code snippets later, but delving deeper into the topic, I will detail some particulars of each type of Pipe.

<div id="texto-ancla4"/>

## IV. Anonymous Pipes

This type of pipe is the lightest and has the lowest IPC overhead available in .NET. It is very useful for very specific use cases related to communication between processes and **their** subprocesses. Some of the characteristics and limitations are:

  - **Unidirectionality**: This limitation is strict and is the most definitive feature of an Anonymous Pipe. At the time of creation, the direction of communication is specified, being either input or output (`PipeDirection.In` or `PipeDirection.Out`). This means that if bidirectional communication is required, two Anonymous Pipes must be created, one for each direction of communication, which adds complexity to the implementation.
    This type of pipe is especially useful when you want to send signals to a subprocess without exposing the communication channel to other processes in the operating system or network.

  - **Local communication**: As mentioned before, communication is limited from processes to subprocesses, which implies that the scope is strictly local.

  - **Identification by Handle**: Unlike **Named Pipes**, **Anonymous Pipes** lack a name, so they must generate a unique identifier called a **Handle** and pass it securely to the client, so that the latter can know where the connection point is.

  - **Parent-Child Communication**: Everything mentioned above leads to this. This "inheritance" of the Handle is strictly ensured by the Operating System, which at the Kernel level is capable of identifying the process hierarchy and does not allow the use of the handle in an unrelated process. A common way to share the Handle is as an argument when starting the child process, and that is the approach that will be demonstrated later.

<div id="texto-ancla5"/>

### A. Possible use cases

  - **Proxy Server**: A service with a design similar to Nginx could benefit from the use of anonymous pipes. Nginx uses other very efficient forms of IPC communication instead of anonymous pipes to minimize IPC communication, but its design could be an example of a practical use case.
  
  > Nginx uses `Signals` and `Shared Memory` for IPC communication, which reduces communication overhead to the necessary minimum.
  
  This design, now implemented on pipes, would be based on a master process and several worker subprocesses that receive signals about when they should update their configuration, stop, or perform a task. In many cases, this could be simpler with Threads and an implementation of the Observer pattern, but a failure in the code of a thread could kill the entire main process if not handled correctly, leading to the drop of all ongoing connections. In contrast, anonymous pipes strengthen systems thanks to their decoupled design and reducing risk to a minimum.


  - **Redirection of standard streams (Standard I/O)**: Due to the need for continuous communication in this particular case, a process could benefit from directly reading the **Standard Input/Output** (stdin/stdout) when, for example: requesting the conversion of a video using `ffmpeg`, and capturing both `stdin` and `stdout` to read the task's progress or capture possible failures.

  - **Simple communication between threads**: Although I mentioned it before as a possible design weakness, anonymous pipes can facilitate communication between threads within the same process. Here it is worth noting that instead of passing the Handle string, the `SafePipeHandle` object can be passed to a new thread, which turns out to be considerably safer and more efficient.

  - **Simple background tasks**: Similar to the **StdIn/Out** redirection example, the unidirectional nature of Anonymous Pipes could be sufficient for a **Fire n' Forget** scenario, sending the child process the necessary information to perform its task, and forgetting about it. That is, letting the latter do its job without requiring active monitoring of the task's status.

<div id="texto-ancla6"/>

### B. Practical implementation

Next, a very simplified implementation example will be shown so that it can be analyzed later in this article. However, this code will be available in the repository that will be attached at the end of this content.

Example code available at [https://github.com/pablomederos/dotnet-anonymous-pipes](https://github.com/pablomederos/dotnet-anonymous-pipes)

**Server Process (Parent)**: `Program.cs`

```csharp

using System.Diagnostics;
using System.IO.Pipes;

try
{

    await using var server = new AnonymousPipeServerStream(PipeDirection.Out, HandleInheritability.Inheritable);
    string clientHandle = server.GetClientHandleAsString();
    Console.WriteLine($"Server initialized with Client Handle: {clientHandle}");

    await using StreamWriter writer = new(server);
    writer.AutoFlush = true;

    // The client must be compiled before starting the communication
    using var clientProcess = new Process();
    clientProcess.StartInfo.FileName = "../../../../Client/bin/Debug/net8.0/Client";
    clientProcess.StartInfo.Arguments = clientHandle;
    clientProcess.StartInfo.UseShellExecute = false;
    clientProcess.StartInfo.RedirectStandardOutput = true;
    clientProcess.StartInfo.RedirectStandardError = true;
    
    // Add handlers to capture the output of the child process
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
        Console.Error.WriteLine("Client process not started");
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

    Console.WriteLine("Server finished");

    if (!clientProcess.WaitForExit(TimeSpan.FromSeconds(3)))
    {
        Console.WriteLine("Forcing client to close");
        clientProcess.Kill();
    }
    
}
catch (Exception ex)
{
    Console.Error.WriteLine(ex);
}


```

**Client Process (Child)** - `Program.cs`

```csharp
using System.IO.Pipes;

try
{
    string clientHandle = args[0];
    Console.WriteLine($"Client handle: {clientHandle}");

    await using var client = new AnonymousPipeClientStream(PipeDirection.In, clientHandle);

    if (!client.IsConnected) return;

    Console.WriteLine("Client initialized");

    using StreamReader reader = new(client);

    while (await reader.ReadLineAsync() is { } line)
    {
        if (line == "exit")
        {
            Console.WriteLine("Connection closed");
            break;
        }

        Console.WriteLine($"The server says: {line}");
    }
}
catch (Exception ex)
{
    Console.Error.WriteLine(ex);
}
```

The line `string? serverMessage = Console.ReadLine();` implies that the server will wait for user input via the keyboard and send the message to the client using the Pipe. Both the Server's and the Client's terminal output will show the data flow from one process to the other.

<div id="texto-ancla7"/>

### C. Handle lifecycle

At a certain point, the server calls `server.DisposeLocalCopyOfClientHandle();`. This is fundamental in the pipe's synchronization logic, and it is important to understand its use to avoid hard-to-debug errors.

The Handle is the means by which the client identifies its end of the pipe, whether for writing or reading (remembering that it is unidirectional communication). The operating system has a reference count that it uses to manage the lifecycle of Kernel objects, like Pipes in this case.

The flow of events is as follows:

1.  The server creates the `AnonymousPipeServerStream` instance, resulting in a pair of Handles in the kernel. One for writing and one for reading.
2.  Calling `server.GetClientHandleAsString()` obtains a representation of the Handle that the client will use. As the server argument `PipeDirection.Out` was used in the code example, `server.GetClientHandleAsString()` will return a Handle for reading. Conversely, for a server input configuration, `server.GetClientHandleAsString()` would return a write Handle.
3.  The client's Handle is passed to the child process, which will use it to open its end of the pipe. We use `HandleInheritability.Inheritable` as a server argument to allow a child process to use the pipe.
4.  If the server did not call `DisposeLocalCopyOfClientHandle()`, the parent process would maintain a reference to that end of the pipe. This call detaches the parent process from that Handle and must be done immediately after the child process has been started. When the child process finishes its work, it releases the Handle of its end of the pipe, but from the operating system's perspective, if the server had not previously released the Handle, the pipe could not be released, and therefore, the result would be a **deadlock**, with the server hanging, waiting for a pipe finalization event that would never occur.

It's good to think of the call to `server.DisposeLocalCopyOfClientHandle();` as a way of sending the operating system a message like: "I have already delivered the handle to the client and I am not responsible for that end of the pipe."

<div id="texto-ancla8"/>

## V. Named Pipes

While, as mentioned before, anonymous pipes are specialized for simple, local communication, *Named Pipes* are a solution that eliminates the main limitations of anonymous pipes, adding flexibility and robustness, making them more appropriate for a wide variety of software architectures.

<div id="texto-ancla9"/>

### A. Characteristics

  - **Access by name**: The most significant difference is that named pipes can be discovered using a text string as a name. This allows for decoupling processes, as a parent-child relationship or Handle sharing is not required. A pipe can be opened by any other process that knows its name.

  - **Bidirectionality**: This is another notable difference, as named pipes not only support unidirectional communication (`PipeDirection.In` or `PipeDirection.Out`), but also communication in both directions of the channel through the `PipeDirection.InOut` configuration. Clearly, this greatly simplifies implementation.

  - **Support for multiple clients**: A single server process can serve multiple clients. This is configurable via the `maxNumberOfServerInstances` parameter, which tells the operating system how many concurrent connections can exist for a given pipe name. If you wish to use the maximum limit allowed by the system, you can use the value `NamedPipeServerStream.MaxAllowedServerInstances`.

> Something to keep in mind is that each new instance of the `NamedPipeServerStream` class is only capable of handling a single connection, so for each client you wish to serve, a new instance of `NamedPipeServerStream` must be created.

  - **Limited Network Access**: The purpose of pipes is their use on the local machine; however, it is also possible to use them across the local network by adding the remote machine's name when initiating the connection. While a TCP/IP socket might be more advisable in these cases, it could also be viable to reuse the pipe implementation to communicate services both locally and across the network simultaneously.

  - **Security**: In Windows, named pipes follow the same rules as other services, adhering to the system's security rules. It is possible to apply Access Control Lists (ACLs) to a pipe to limit access for users and groups to connect, read, or write.

<div id="texto-ancla10"/>

### B. Possible use cases

As with anonymous pipes, I will list some possible use cases for named pipes, but I only intend to shed some light that might lead the reader to find their own, perhaps more appropriate or varied, use cases.

  - **Local Services**: A possibly useful application is sending commands to a long-running service and monitoring its status. Such a service could expose the server so that several other processes can connect and queue tasks, while also being able to send notifications about the status of ongoing tasks.
  - **Communication between unrelated processes**: Almost the same as the previous point, but now promoting decoupling, and independent development and deployment of applications.
  - **Transport for RPC**: The above leads to this; the low overhead allows named pipes to be an ideal transport for **RPC** frameworks.
  - **Communication between different Languages**: This is no longer limited to named pipes, but being an operating system feature and not exclusive to .NET, whether using named pipes or starting a process as a child, pipes are an effective channel for establishing communication between applications developed in different programming languages, such as *C++*, *Python*, *Go*, etc., thus avoiding the overhead that a Socket connection could entail.

<div id="texto-ancla11"/>

### C. Practical implementation

Example code available at [https://github.com/pablomederos/dotnet-named-pipes](https://github.com/pablomederos/dotnet-named-pipes)

**Server** - `Program.cs`

```csharp
using System.IO.Pipes;

try
{
    // If there were many clients, the ideal would be
    Console.WriteLine("Configuring the server");

    await using NamedPipeServerStream server = new("NamedPipe", PipeDirection.InOut);

    Console.WriteLine("Server started");
    await server.WaitForConnectionAsync();

    Console.WriteLine("Connection with the client established");

    using StreamReader reader = new(server);
    await using StreamWriter writer = new(server);
    writer.AutoFlush = true;

    // Sync protocol
    // Waiting for the client to be ready
    if(await reader.ReadLineAsync() == "READY")
        await writer.WriteLineAsync("Welcome");


    while (true)
    {
        string? receivedMessage = await reader.ReadLineAsync();
        if (receivedMessage != null)
        {
            if (receivedMessage == "exit")
            {
                await writer.WriteLineAsync("Thank you for the connection. Bye!");
                Console.WriteLine("Closing the connection");
                break;
            }

            Console.WriteLine(receivedMessage);
            await writer.WriteLineAsync("Message received");
        }
    }
}
catch (Exception ex)
{
    Console.WriteLine(ex);
}
```

**Client** - `Program.cs`

```csharp
using System.IO.Pipes;

try
{
    Console.WriteLine("Configuring the client");
    await using NamedPipeClientStream client = new("NamedPipe");

    await client.ConnectAsync();
    Console.WriteLine("Client connected to the server");

    using StreamReader reader = new(client);
    await using StreamWriter writer = new(client);
    writer.AutoFlush = true;
    
    // Sync protocol
    // Ready for messaging notification
    await writer.WriteLineAsync("READY");


    string? firstReceivedMessage = await reader.ReadLineAsync();
    Console.WriteLine($"Connected with the message: {firstReceivedMessage}");

    while (true)
    {
        string? message = Console.ReadLine();
        await writer.WriteLineAsync(message);

        string? receivedMessage = await reader.ReadLineAsync();
        Console.WriteLine($"The server replies: {receivedMessage}");

        if (message == "exit")
            break;
    }
}
catch (Exception ex)
{
    Console.WriteLine(ex);
}
```

Unlike the previous code, this one does not require manually releasing a Handle during the connection process, and it is a clear example of bidirectional communication.
A possible overload for initializing the client instance could be `NamedPipeClientStream(".", "NamedPipe", PipeDirection.InOut)`, where `"."` is the remote machine's name. A period refers to `localhost`.
If it is required to serve more than one client concurrently with the same pipe, the `NamedPipeServerStream` overload must also contain the `maxNumberOfServerInstances` parameter for each new instance created, but one instance can only handle a single connection, and it will be necessary to create as many instances as connections are required.

This is because a pipe is a **point-to-point** connection between the client and the server. Furthermore, this implies that an instance cannot be reused once a client disconnects, as it would result in an `ObjectDisposedException`.

The following is a highly simplified example of an implementation for multiple clients, using a single named pipe (multiple instances of it), but it serves to illustrate what I mentioned earlier:

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

    static async Task Main(string[] args)
    {
        int clientId = 0;

        // Infinite loop to continuously accept clients.
        while (true)
        {
            try
            {
                var server = new NamedPipeServerStream(
                    PipeName,
                    PipeDirection.InOut,
                    MaxInstances, // Maximum number of allowed instances.
                    PipeTransmissionMode.Byte,
                    PipeOptions.Asynchronous);

                Console.WriteLine($"({Thread.CurrentThread.ManagedThreadId}) Waiting for client connection...");
                
                await server.WaitForConnectionAsync();
                
                int currentId = Interlocked.Increment(ref clientId);
                Console.WriteLine($"Client #{currentId} connected.");

                // Launch a new task to handle communication with this client,
                // so as not to block the main acceptance loop.
                _ = Task.Run(() => HandleClient(server, currentId));
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in the server loop: {ex.Message}");
            }
        }
    }

    static async Task HandleClient(NamedPipeServerStream stream, int clientId)
    {
        Console.WriteLine($"({Thread.CurrentThread.ManagedThreadId}) Handling client #{clientId}.");
        await using (stream)
        await using (var writer = new StreamWriter(stream) { AutoFlush = true })
        {
            using var reader = new StreamReader(stream);

            try
            {
                await writer.WriteLineAsync($"Welcome, client #{clientId}!");

                string line;
                while ((line = await reader.ReadLineAsync()) != null)
                {
                    Console.WriteLine($"Client #{clientId} says: {line}");
                    if (line.Equals("exit", StringComparison.OrdinalIgnoreCase))
                    {
                        break;
                    }
                    await writer.WriteLineAsync($"Echo: {line}");
                }
            }
            catch (IOException)
            {
                Console.WriteLine($"Client #{clientId} has disconnected abruptly.");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error handling client #{clientId}: {ex.Message}");
            }

            Console.WriteLine($"Communication with client #{clientId} finished.");
        }
    }
}
```

<div id="texto-ancla12"/>

## D. Some important points

1.  **Transmission mode**: Pipes operate in Byte mode by default (`PipeTransmissionMode.Byte`) to maximize cross-platform compatibility. This implies that data is treated as a continuous stream of bytes between the ends of the pipe, so the programmer must establish a protocol to indicate to the other end of the pipe when a message ends and when another begins. Usually, this is avoided by using a *StreamReader/StreamWriter* on top of the pipe, which already has an implicit "protocol" based on accumulating the data stream in a buffer until a line-ending character (`\n` or `\r\n`) is found. However, the `PipeTransmissionMode.Message` mode can also be configured, which is only supported by Windows, where each write operation will be treated as an atomic message. This, as mentioned before, saves the developer from implementing a "framing" logic so that the other end of the pipe can determine when a message ends and when the next one begins.

**Byte Mode**:

```csharp

// Server
class ServerByteMode
{
    public static void StartServer()
    {
        using var server = new NamedPipeServerStream(
            "TestBytes",
            PipeDirection.InOut,
            1,
            PipeTransmissionMode.Byte);

        server.WaitForConnection();
        
        // You need to implement your message protocol
        var reader = new BinaryReader(server);
        var writer = new BinaryWriter(server);
        
        while (server.IsConnected)
        {
            try
            {
                // Read message length first
                int length = reader.ReadInt32();
                
                // Read the full message
                byte[] message = reader.ReadBytes(length);
                
                Console.WriteLine($"Message received: {Encoding.UTF8.GetString(message)}");
                
                // Respond
                var response = Encoding.UTF8.GetBytes("Message processed");
                writer.Write(response.Length);
                writer.Write(response);
                writer.Flush();
            }
            catch (EndOfStreamException)
            {
                break;
            }
        }
    }
}

// Client
class ClientByteMode
{
    public static void ConnectClient()
    {
        using var client = new NamedPipeClientStream(".", "TestBytes", PipeDirection.InOut);
        client.Connect();
        
        var writer = new BinaryWriter(client);
        var reader = new BinaryReader(client);
        
        // Send message with length protocol
        var message = Encoding.UTF8.GetBytes("Hello server!");
        writer.Write(message.Length); // Send length first
        writer.Write(message);        // Send data
        writer.Flush();
        
        // Read response
        int responseLength = reader.ReadInt32();
        byte[] response = reader.ReadBytes(responseLength);
        Console.WriteLine($"Response: {Encoding.UTF8.GetString(response)}");
    }
}
```

**Message Mode (Windows Only)**:

```csharp
// Server - Message Mode
class ServerMessageMode
{
    public static void StartServer()
    {
        using var server = new NamedPipeServerStream(
            "TestMessages",
            PipeDirection.InOut,
            1,
            PipeTransmissionMode.Message); // Only on Windows

        server.WaitForConnection();
        
        byte[] buffer = new byte[1024];
        
        while (server.IsConnected)
        {
            try
            {
                // Each Read() gets a complete message
                int bytesRead = server.Read(buffer, 0, buffer.Length);
                
                if (bytesRead > 0)
                {
                    string message = Encoding.UTF8.GetString(buffer, 0, bytesRead);
                    Console.WriteLine($"Message received: {message}");
                    
                    // Respond - each Write is a complete message
                    byte[] response = Encoding.UTF8.GetBytes("Message processed");
                    server.Write(response, 0, response.Length);
                }
            }
            catch (IOException)
            {
                break;
            }
        }
    }
}

// Client
class ClientMessageMode
{
    public static void ConnectClient()
    {
        using var client = new NamedPipeClientStream(".", "TestMessages", PipeDirection.InOut);
        client.Connect();
        
        // Each Write is a complete message
        byte[] message = Encoding.UTF8.GetBytes("Hello server!");
        client.Write(message, 0, message.Length);
        
        // Each Read gets a complete message
        byte[] buffer = new byte[1024];
        int bytesRead = client.Read(buffer, 0, buffer.Length);
        
        string response = Encoding.UTF8.GetString(buffer, 0, bytesRead);
        Console.WriteLine($"Response: {response}");
    }
}
```

2.  **Security**: As mentioned before, pipes support the application of **Access Control Lists** (ACLs). This is also a platform-dependent feature, currently only supported on Windows.
    This feature allows protecting a service in a multi-user environment using the `PipeSecurity` class, through programmatic access rules. The idea is to create an instance of `PipeSecurity` and add one or more `PipeAccessRule` that specify a user or group, using an `IdentityReference`.
    `IdentityReference` will contain the rights granted (`PipeAccessRights`), and whether access is allowed or denied (`AccessControlType`).

**Example**:

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
        
        // Administrators: Full control
        pipeSecurity.AddAccessRule(new PipeAccessRule(
            new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid, null),
            PipeAccessRights.FullControl,
            AccessControlType.Allow));
        
        // Power Users: Read and write
        pipeSecurity.AddAccessRule(new PipeAccessRule(
            new SecurityIdentifier(WellKnownSidType.BuiltinPowerUsersSid, null),
            PipeAccessRights.ReadWrite,
            AccessControlType.Allow));
        
        // Normal Users: Read-only
        pipeSecurity.AddAccessRule(new PipeAccessRule(
            new SecurityIdentifier(WellKnownSidType.BuiltinUsersSid, null),
            PipeAccessRights.Read,
            AccessControlType.Allow));
        
        // Custom company group
        try
        {
            var applicationGroup = new NTAccount("COMPANY\\ApplicationGroup");
            pipeSecurity.AddAccessRule(new PipeAccessRule(
                applicationGroup,
                PipeAccessRights.ReadWrite,
                AccessControlType.Allow));
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Could not configure custom group: {ex.Message}");
        }
        
        // Explicitly deny guests
        pipeSecurity.AddAccessRule(new PipeAccessRule(
            new SecurityIdentifier(WellKnownSidType.BuiltinGuestsSid, null),
            PipeAccessRights.FullControl,
            AccessControlType.Deny));

        using (var server = new NamedPipeServerStream(
            "PipeWithRoles",
            PipeDirection.InOut,
            1,
            PipeTransmissionMode.Byte,
            PipeOptions.None,
            1024,
            1024,
            pipeSecurity))
        {
            Console.WriteLine("Server started with role-based access control...");
            server.WaitForConnection();
            Console.WriteLine("Client connected with appropriate permissions.");
        }
    }
}
```

<div id="texto-ancla13"/>

## VI. Integration with Advanced Frameworks

The direct use of pipes via `System.IO.Pipes` is an excellently useful tool for low-level transport, and this is a great advantage for its use as an underlying high-performance transport for more abstract frameworks.
ASP.NET Core and gRPC benefit considerably from named pipes to optimize IPC communication by separating the application layer from the transport layer.

<div id="texto-ancla14"/>

### A. Pipes as High-Performance Transport

An immense architectural advantage can be the ability to swap the transport layer without altering the application's logic, and to design an application to operate in different deployment topologies.
A microservice deployed in containers could take advantage of TCP/IP communication, while for integration tests or high-performance/limited-resource scenarios, pipes could be a better option. Kestrel (the web server in ASP.NET Core) allows taking advantage of this flexibility, optimizing performance without rewriting the business logic.

<div id="texto-ancla15"/>

  - #### 1. ASP.NET Core with Named Pipes

ASP.NET Core, through the Kestrel web server, is capable of listening to requests not only on TCP ports but also through named pipes, thus exposing a complete RESTful API (controllers, middleware, dependency injection, etc.), through a local, secure, high-performance IPC channel without opening network ports on the machine.

##### Example:

  - **Server**

```csharp
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Server.Kestrel.Core;

var builder = WebApplication.CreateBuilder(args);

// Kestrel configuration
builder.WebHost.ConfigureKestrel(options =>
{
    options.ListenNamedPipe("my-api-pipe", listenOptions =>
    {
        // HTTP/2 is required if you plan to use gRPC over this pipe.
        // For simple REST, HTTP/1.1 is sufficient.
        listenOptions.Protocols = HttpProtocols.Http1AndHttp2;
    });
});

builder.Services.AddControllers();
var app = builder.Build();

app.MapGet("/", () => "ASP.NET Core server listening on a named pipe!");
app.MapControllers();

app.Run();
```

  - **Client**

<!-- end list -->

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
        const string pipeName = "my-api-pipe";

        // Create a custom SocketsHttpHandler.
        var handler = new SocketsHttpHandler
        {
            // The ConnectCallback overrides the standard TCP connection logic.
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

        // The host in the URI is arbitrary, as the connection is redirected to the pipe.
        var response = await httpClient.GetAsync("http://localhost/WeatherForecast");

        if (response.IsSuccessStatusCode)
        {
            var content = await response.Content.ReadAsStringAsync();
            Console.WriteLine("Server response via the pipe:");
            Console.WriteLine(content);
        }
        else
        {
            Console.WriteLine($"Error: {response.StatusCode}");
        }
    }
}
```

<div id="texto-ancla16"/>

- #### 2. Typed RPC with StreamJsonRpc

One of my favorite uses is the one given in the **C\# Dev Kit** tool for **Visual Studio Code**, for communication between the extension written in TypeScript and the language server in C\#.

Many scenarios do not require the full ASP.NET Core stack, so using the `StreamJsonRpc` library offers an efficient and lightweight solution for making remote procedure calls (RPC) over any data `Stream`. This results in a strongly typed, low-latency communication system with minimal configuration.
This genius returns to the point in the introduction of this article, opening the doors to other more efficient and appropriate ways to solve issues related to local IPC communication.

##### Example:

  - **Shared Kernel**

<!-- end list -->

```csharp
  public interface ICalculator {
      Task<int> Add(int a, int b);
  }
```

  - **Server**:

<!-- end list -->

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

     Console.WriteLine("RPC Server connected. Waiting for calls...");

     // Wait for the connection to close.
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

  - **Client**:

<!-- end list -->

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
        Console.WriteLine($"Result of the RPC call: 5 + 3 = {result}");
    }
}
```

<div id="texto-ancla17"/>

  - #### 3. gRPC with Named Pipes

gRPC is Google's modern framework for high-performance RPC, and, the spiritual successor to WCF for ASP.NET Core. By default, it uses HTTP/2 over TCP sockets as transport, which introduces unnecessary overhead, as we saw earlier, when the client and server run on the same machine.
**The answer**: gRPC on ASP.NET can also be configured to use named pipes as transport. Clearly, this combines the ease of use and typed contracts of gRPC with the high performance of pipes.

##### Example:

  - **Server**

```csharp
builder.WebHost.ConfigureKestrel(options =>
{
 // Same as before with the RESTful API
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

  - **Client**

<!-- end list -->

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

        // Create the gRPC channel pointing to a fictitious host and using the custom handler.
        var channel = GrpcChannel.ForAddress("http://localhost", new GrpcChannelOptions
        {
            HttpHandler = socketsHttpHandler
        });

        var client = new Greeter.GreeterClient(channel);
        var reply = await client.SayHelloAsync(new HelloRequest { Name = "gRPC Client over Pipe" });

        Console.WriteLine("gRPC Response: " + reply.Message);
    }
}

// Helper class to manage the connection to the pipe.
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

<div id="texto-ancla18"/>

## VII. Pipes vs. Other IPC Mechanisms in .NET

Choosing an IPC mechanism is always an important architectural decision that has more to do with functionality than just performance and complexity trade-offs.
I will compare Pipes with other popular alternatives in the .NET catalog that will be available in other articles of this Wiki:

<div id="texto-ancla19"/>

### A. Pipes vs. Sockets

  - **Performance**: When it comes to local communication or within the same machine, pipes (and their Linux equivalent, UDS) are significantly faster than TCP/IP sockets. This is because pipes bypass much of the operating system's network stack. This means not building TCP headers, calculating checksums, 3-way handshakes, etc., being replaced by more direct data communication through kernel buffers.
  - **Flexibility and uses**: Undoubtedly, TCP/IP Sockets have the advantage in this field, as they allow intercommunication of processes on different machines across the network. While named pipes also support LAN communication, they are not designed for robust network communication.
  - **Complexity**: We saw earlier that pipes are very easy to configure, only requiring knowledge of the pipe's name. This avoids the management of IP addresses and ports or other conflicts related to their availability.
  - **Conclusion**: Pipes are always the best choice when it comes to local IPC communication. If the communication will go beyond the machine's boundaries, TCP/IP Sockets are the most suitable option.

<div id="texto-ancla20"/>

### B. Pipes vs. Memory Mapped Files

This comparison might seem strange, given that they are two completely different paradigms; however, knowing all the possibilities in the programmer's "Swiss army knife" makes it possible to make a better decision when it comes to making the most of each resource.

  - **Paradigm**: Pipes use a **sharing by communication** approach. Data is copied from one process's memory to a kernel buffer, and from there to the memory space of the next process. However, **Memory Mapped Files** use a **communicating by sharing** approach. That is, a region of memory is mapped into the virtual address space of several processes, which avoids data copying, with all operating on the same memory.
  - **Performance**: For the reason stated in the previous point, **Memory Mapped Files** offer the highest performance when it comes to sharing large volumes of data on the same machine, as they avoid data copying between memory spaces.
  - **Synchronization and complexity**: Because **Memory Mapped Files** do not have an inherent mechanism for synchronization, the developer is responsible for doing this work. On the contrary, a pipe will block on a read operation until data is available. This lack in **Memory Mapped Files** increases complexity and exposes data to race conditions, corruption, or other hard-to-debug errors.
  - **Conclusion**: When performance is an unquestionable priority, **Memory Mapped Files** are the most suitable option, as they allow concurrent and high-speed access to large volumes of data (for example, a video frame, a data matrix, or any other significant volume of data that should not be duplicated in memory or requires immediate access between different processes). However, pipes still offer excellent performance and are a better option when sequential flow and implicit synchronization are required.

<div id="texto-ancla21"/>

### C. Pipes vs. gRPC

It doesn't seem fair to make this comparison, as pipes are a low-level transport mechanism, and **gRPC** is a high-level RPC framework. But as we saw before, the possibility of using pipes or not on the server can offer a significant advantage in terms of security and performance, whether used in conjunction with **gRPC** or separately.

  - **Ease of use**: In terms of separate use, **gRPC** is much easier to use and maintain. It has `.proto` contracts and code generation, which eliminates a host of manual serialization/deserialization errors. Therefore, **gRPC** is much less error-prone than building a custom protocol over a raw pipe.
  - **Performance**: It was mentioned earlier in this article, and the truth is that **gRPC** over TCP/IP adds unnecessary network overhead in processes running on the same machine compared to the direct use of pipes. The solution is undoubtedly the combination of both, which offers the highest performance of pipes and the ease of use of **gRPC**.
  - **Conclusion**: Avoiding building complex protocols manually over pipes would be ideal, but clearly for local IPC communication, pipes are the best option for some less complex cases. **gRPC** is more suitable for building robust, maintainable, and scalable IPC APIs, although it is even better to configure named pipes as its transport to maximize performance.

<div id="texto-ancla22"/>

### D. Pipes vs. Message Queues

If I mentioned **gRPC** before, I cannot leave behind other communication options like **RabbitMQ**, **MSMQ**, etc.

  - **Coupling**: Pipes establish a temporary and direct coupling between the client and the server, which means that both must be running simultaneously for communication to be established. Message queues completely decouple the producer and consumer, so messages can be sent regardless of whether both processes are active or not.
  - **Reliability**: Message queues offer message persistence and delivery guarantees, making them ideal for scenarios where a system cannot afford to lose messages. Instead, pipes do not, and if the client is not listening at that moment, the messages will be lost.
  - **Scalability**: Message queues are designed for distributed systems and support advanced communication patterns, message routing, and load balancing among multiple consumers reading the same queue. Pipes, instead, are a point-to-point mechanism.
  - **Conclusion**: Here, the deployment model and the solution's architecture will play the central role in decision-making. Pipes remain the ideal solution for direct, low-latency, real-time communication between local processes, but they maximize coupling. Message queues are ideal when asynchronous, decoupled, and reliable communication is required. And surely, they are the undisputed choice in distributed, event-based systems that require resilience to failures.

I am a fan of performance, but when it comes to IPC communication, it's not just a matter of benchmarks and preferences, but also of a system's requirements and the trade-off between flexibility, reliability, and scalability.

<div id="texto-ancla23"/>

### E. Comparative table

To summarize the above a bit, I leave this comparative table as a reference, which I think could help make better decisions when choosing the best tool to solve a problem.

|Criterion|Memory-Mapped Files|Pipes (Named/UDS)|Sockets (TCP/IP)|gRPC (over TCP)|Message Queues|
|:---:|:---:|:---:|:---:|:---:|:---:|
|**Local Performance**|★★★★★ (The Highest)|★★★★☆ (Very High)|★★★☆☆ (Network Overhead)|★★★☆☆ (Good)|★☆☆☆☆ (Slower)|
|**Paradigm**|Shared Memory|Message Stream|Network Stream|Typed RPC|Asynchronous Messaging|
|**Complexity**|★★★★★ (Very High, manual sync)|★★☆☆☆ (Low/Moderate)|★★★☆☆ (Moderate)|★☆☆☆☆ (The Lowest)|★★★☆☆ (Broker config.)|
|**Coupling**|Strong (Data)|Strong (Temporal)|Strong (Temporal)|Strong (Contract)|Weak (Total)|
|**Network Use**|No|Limited (LAN)|Yes (Native)|Yes (Native)|Yes (Native)|
|**Ideal For...**|Sharing large datasets, shared state.|Local services, IPC API, transport for RPC.|Standard client-server communication on network.|Microservice APIs, cross-language communication.|Distributed systems, resilience, background tasks.|

<div id="texto-ancla24"/>

## VIII. Final conclusion

Although traditionally seen as outdated, pipes in C\# and .NET are modern and powerful tools for high-performance local communication, essential for Inter-Process Communication (IPC). Their evolution in .NET, with cross-platform implementation and integration into extensions and frameworks like ASP.NET Core and gRPC, underscores their relevance. For a .NET software architect, a thorough understanding of pipes and choosing the right IPC mechanism (anonymous, named, MMF, or gRPC) is crucial for designing efficient, robust, and scalable systems.