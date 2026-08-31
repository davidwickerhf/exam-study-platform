import AppKit
import Foundation

struct ImportInput: Decodable {
  let courseUrl: String?
  let outputFolder: String?
  let hasAccessToken: Bool?
}

struct ImportOutput: Encodable {
  let courseUrl: String
  let outputFolder: String
  let accessToken: String
  let cancelled: Bool
}

private let wickerIndigo = NSColor(calibratedRed: 0.247, green: 0.318, blue: 0.851, alpha: 1)
private let wickerSoft = NSColor(calibratedRed: 0.91, green: 0.918, blue: 0.996, alpha: 1)

private func trimmed(_ value: String) -> String {
  value.trimmingCharacters(in: .whitespacesAndNewlines)
}

private func decodedInput() -> ImportInput {
  guard let encoded = CommandLine.arguments.dropFirst().first else { return ImportInput(courseUrl: nil, outputFolder: nil, hasAccessToken: nil) }
  let normalized = encoded.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
  let padded = normalized + String(repeating: "=", count: (4 - normalized.count % 4) % 4)
  guard let data = Data(base64Encoded: padded), let input = try? JSONDecoder().decode(ImportInput.self, from: data) else {
    return ImportInput(courseUrl: nil, outputFolder: nil, hasAccessToken: nil)
  }
  return input
}

private func write(_ output: ImportOutput) {
  guard let data = try? JSONEncoder().encode(output), let text = String(data: data, encoding: .utf8) else { return }
  FileHandle.standardOutput.write(Data(text.utf8))
}

final class ImportForm: NSObject {
  private let input: ImportInput
  private let alert = NSAlert()
  private let courseField = NSTextField()
  private let folderField = NSTextField(labelWithString: "")
  private let tokenField = NSSecureTextField()
  private let validation = NSTextField(labelWithString: "")

  init(input: ImportInput) {
    self.input = input
    super.init()
    configure()
  }

  private func label(_ value: String) -> NSTextField {
    let field = NSTextField(labelWithString: value)
    field.font = NSFont.systemFont(ofSize: 12, weight: .semibold)
    field.textColor = .labelColor
    return field
  }

  private func help(_ value: String) -> NSTextField {
    let field = NSTextField(wrappingLabelWithString: value)
    field.font = NSFont.systemFont(ofSize: 11)
    field.textColor = .secondaryLabelColor
    field.maximumNumberOfLines = 0
    return field
  }

  private func section() -> NSView {
    let rule = NSBox()
    rule.boxType = .separator
    rule.heightAnchor.constraint(equalToConstant: 1).isActive = true
    return rule
  }

  private func configure() {
    alert.messageText = "Import a Canvas course"
    alert.informativeText = "Create a private, organised source snapshot. Canvas login stays with Canvas."
    alert.alertStyle = .informational
    alert.icon = NSImage(systemSymbolName: "arrow.down.circle", accessibilityDescription: "Import")
    alert.addButton(withTitle: "Import locally")
    alert.addButton(withTitle: "Cancel")

    let card = NSView()
    card.wantsLayer = true
    card.layer?.backgroundColor = wickerSoft.cgColor
    card.layer?.cornerRadius = 8

    let content = NSStackView()
    content.orientation = .vertical
    content.alignment = .leading
    content.spacing = 8
    content.translatesAutoresizingMaskIntoConstraints = false
    card.addSubview(content)
    NSLayoutConstraint.activate([
      content.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 16),
      content.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -16),
      content.topAnchor.constraint(equalTo: card.topAnchor, constant: 16),
      content.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -16),
      card.widthAnchor.constraint(equalToConstant: 540)
    ])

    let privacy = NSTextField(labelWithString: "PRIVATE LOCAL IMPORT")
    privacy.font = NSFont.monospacedSystemFont(ofSize: 10, weight: .semibold)
    privacy.textColor = wickerIndigo
    content.addArrangedSubview(privacy)
    content.addArrangedSubview(help("The token is used once for this import. It is not saved, logged, or sent to Wicker Study."))
    content.addArrangedSubview(section())

    content.addArrangedSubview(label("Canvas Modules URL"))
    courseField.placeholderString = "https://canvas.maastrichtuniversity.nl/courses/…/modules"
    courseField.stringValue = input.courseUrl ?? ""
    courseField.font = NSFont.systemFont(ofSize: 14)
    courseField.controlSize = .large
    courseField.heightAnchor.constraint(equalToConstant: 32).isActive = true
    courseField.widthAnchor.constraint(equalToConstant: 508).isActive = true
    content.addArrangedSubview(courseField)

    content.addArrangedSubview(label("Destination folder"))
    let folderRow = NSStackView()
    folderRow.orientation = .horizontal
    folderRow.alignment = .centerY
    folderRow.spacing = 8
    folderField.font = NSFont.monospacedSystemFont(ofSize: 11, weight: .regular)
    folderField.lineBreakMode = .byTruncatingMiddle
    folderField.setContentHuggingPriority(.defaultLow, for: .horizontal)
    folderField.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
    folderField.widthAnchor.constraint(greaterThanOrEqualToConstant: 360).isActive = true
    let chooseButton = NSButton(title: "Choose folder…", target: self, action: #selector(chooseFolder))
    chooseButton.bezelStyle = .rounded
    chooseButton.controlSize = .regular
    folderRow.addArrangedSubview(folderField)
    folderRow.addArrangedSubview(chooseButton)
    content.addArrangedSubview(folderRow)
    setFolder(input.outputFolder ?? "")

    content.addArrangedSubview(label("Canvas Personal Access Token"))
    tokenField.placeholderString = input.hasAccessToken == true ? "Optional: paste a replacement token" : "Paste a short-lived token"
    tokenField.font = NSFont.monospacedSystemFont(ofSize: 13, weight: .regular)
    tokenField.controlSize = .large
    tokenField.heightAnchor.constraint(equalToConstant: 32).isActive = true
    tokenField.widthAnchor.constraint(equalToConstant: 508).isActive = true
    content.addArrangedSubview(tokenField)
    content.addArrangedSubview(help("Use a Personal Access Token from Canvas — never your university password or OTP."))

    validation.font = NSFont.systemFont(ofSize: 11, weight: .medium)
    validation.textColor = .systemRed
    validation.isHidden = true
    content.addArrangedSubview(validation)
    alert.accessoryView = card
  }

  private func setFolder(_ path: String) {
    let clean = trimmed(path)
    folderField.stringValue = clean.isEmpty ? "No folder chosen" : clean
    folderField.textColor = clean.isEmpty ? .secondaryLabelColor : .labelColor
  }

  @objc private func chooseFolder() {
    let panel = NSOpenPanel()
    panel.title = "Choose a Canvas import folder"
    panel.message = "Choose a new empty folder or a previous Wicker Study Canvas import folder."
    panel.prompt = "Use this folder"
    panel.canChooseFiles = false
    panel.canChooseDirectories = true
    panel.canCreateDirectories = true
    panel.allowsMultipleSelection = false
    if panel.runModal() == .OK, let folder = panel.url?.path { setFolder(folder) }
  }

  func present() -> ImportOutput {
    // A Swift command-line process defaults to a background activation policy.
    // Without promoting it first, `runModal()` can block with an alert window that
    // exists but is hidden behind a full-screen Terminal window (or on another Space).
    let application = NSApplication.shared
    application.setActivationPolicy(.regular)
    let window = alert.window
    window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
    window.level = .modalPanel
    window.center()
    window.makeKeyAndOrderFront(nil)
    window.orderFrontRegardless()
    NSRunningApplication.current.activate(options: [.activateAllWindows, .activateIgnoringOtherApps])
    while true {
      let response = alert.runModal()
      if response != .alertFirstButtonReturn {
        return ImportOutput(courseUrl: "", outputFolder: "", accessToken: "", cancelled: true)
      }
      let courseUrl = trimmed(courseField.stringValue)
      let outputFolder = trimmed(folderField.stringValue == "No folder chosen" ? "" : folderField.stringValue)
      let token = trimmed(tokenField.stringValue)
      let message: String?
      if courseUrl.isEmpty { message = "Add the Canvas Modules URL to continue." }
      else if outputFolder.isEmpty { message = "Choose a dedicated folder to continue." }
      else if token.isEmpty && input.hasAccessToken != true { message = "Paste a Canvas Personal Access Token to continue." }
      else { message = nil }
      guard let message else { return ImportOutput(courseUrl: courseUrl, outputFolder: outputFolder, accessToken: token, cancelled: false) }
      validation.stringValue = message
      validation.isHidden = false
      alert.window.makeFirstResponder(courseUrl.isEmpty ? courseField : tokenField)
    }
  }
}

if CommandLine.arguments.contains("--check") {
  FileHandle.standardOutput.write(Data("{\"ok\":true}".utf8))
} else {
  let form = ImportForm(input: decodedInput())
  write(form.present())
}
