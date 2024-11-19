import Cocoa
// Function to create a window overlay

func showOverlay(title: String, message: String, summary: String, fileName: String, filePath: String, timeout: String){
  let window = NSWindow(
    contentRect: NSMakeRect(0, 0, 600, 370),
    styleMask: .borderless,
    backing: .buffered,
    defer: false
  )

  window.isOpaque = false
  window.backgroundColor = .clear
  window.level = .floating
  window.center()

  let blurEffectView = NSVisualEffectView(frame: window.contentView!.bounds)
  blurEffectView.autoresizingMask = [.width, .height] // Resize with the window
  blurEffectView.state = .active
  blurEffectView.wantsLayer = true
  blurEffectView.layer?.cornerRadius = 15.0 // Adjust radius as needed

  // Create a Label for the title
  let titleLabel = NSTextField(labelWithString: title)
  titleLabel.frame = NSRect(x: 20, y: window.contentView!.frame.height - 80, width: 560, height: 30)
  titleLabel.font = NSFont.systemFont(ofSize: 20, weight: .bold)

  titleLabel.textColor = NSColor.white
  titleLabel.alignment = .center

  // Title
  let fileNameLabel = NSTextField(labelWithString: fileName)
  fileNameLabel.frame = NSRect(x: 20, y: window.contentView!.frame.height - 120, width: 560,height: 30)
  fileNameLabel.font = NSFont.systemFont(ofSize: 20, weight: .bold)
  fileNameLabel.textColor = NSColor.systemBlue
  fileNameLabel.alignment = .center

  // CodeFrame
  let codeFrame = NSTextView(frame: NSRect(x: 40, y: window.contentView!.frame.height - 290, width: 560, height: 150))
  codeFrame.string=message.replacingOccurrences(of: "\\\\n", with:"\n")
  codeFrame.font = NSFont.monospacedSystemFont(ofSize: 16, weight: .bold)
  codeFrame.textColor = NSColor.red
  codeFrame.alignment = .left
  codeFrame.backgroundColor = .clear
  codeFrame.isEditable = false
  codeFrame.isSelectable = true

  // let codeFrame_DOESTWORKVIEW = CodeFrameView(message: message)

  let summaryLabel = NSTextField(labelWithString: summary)
  summaryLabel.frame = NSRect(x: 20, y: window.contentView!.frame.height - 340,width: 560, height: 20)
  summaryLabel.font = NSFont.systemFont(ofSize: 16, weight: .bold)
  summaryLabel.textColor = NSColor.systemYellow
  summaryLabel.alignment = .center

  // Add labels to window content view
  window.contentView?.addSubview(blurEffectView)
  window.contentView?.addSubview(titleLabel)
  window.contentView?.addSubview(fileNameLabel)
  window.contentView?.addSubview(summaryLabel)
  // window.contentView?.addSubview(filePathLabel)
  window.contentView?.addSubview(codeFrame)
  window.makeKeyAndOrderFront(nil)

  // Auto-close after 6 or user-defined seconds
  DispatchQueue.main.asyncAfter(deadline: .now() + (Double(timeout) ?? 6.0)) {
    window.close()
    NSApplication.shared.terminate(nil)
  }
}

// Start the application
let app = NSApplication.shared
app.setActivationPolicy(.accessory)

// Read command-Line arguments for title and message
let arguments = CommandLine.arguments
if arguments.count < 5 {
  print("Usage: ./ErrorPopup ‹title› ‹message› ‹summary› ‹fileName› ‹folder› ‹timeout›")
  exit (1)
}

/*
struct CodeFrameView: View {
    let message: String
    var body: some View {
        let lines = message.components(separatedBy: "\n")

        VStack(alignment: .leading, spacing: 0) {
            ForEach(lines.indices, id: \.self) { index in
                Text(lines[index])
                    .font(.system(size: 16, weight: .bold, design: .monospaced))
                    .foregroundColor((index == 1 || index == 2) ? .systemRed : .red)
                    .background(Color.white)
                    .lineLimit(1).padding(1)
                    .fixedSize(horizontal: true, vertical: false)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: 150, alignment: .leading)
        .background(Color.clear)
    }
}
*/

// Collect CLI Arguments
let title = arguments [1]
let message = arguments [2]
let summary = arguments[3]
let fileName = arguments [4]
let filePath = arguments [5]
let timeout = arguments [6]

// Show the overlay with custom title and message
showOverlay(
  title: title,
  message: message,
  summary: summary,
  fileName: fileName,
  filePath: filePath,
  timeout: timeout
)

app.run()
