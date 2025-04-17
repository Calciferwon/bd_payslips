// Custom Quill module for line height
;(() => {
  const Quill = window.Quill // Get Quill from window
  const Parchment = Quill.import("parchment")

  class LineHeightStyle extends Parchment.Attributor.Style {
    constructor() {
      super("lineheight", "line-height", {
        scope: Parchment.Scope.INLINE,
        whitelist: ["1.0", "1.2", "1.5", "2.0"],
      })
    }
  }

  const lineHeightStyle = new LineHeightStyle()
  Quill.register(lineHeightStyle, true)

  // Add toolbar handler
  const toolbar = Quill.import("modules/toolbar")
  toolbar.DEFAULTS.handlers.lineheight = function (value) {
    this.quill.format("lineheight", value)
  }
})()
