package com.teleport.common

import android.util.Log
import android.view.TextureView
import android.view.View
import android.view.ViewGroup
import java.util.concurrent.atomic.AtomicLong

private const val REPARENT_LOG_TAG = "RNTPReparent"
private val eventSequence = AtomicLong()

internal data class ReparentDecision(
  val portal: View,
  val currentHostName: String?,
  val child: View,
  val source: ViewGroup,
  val target: ViewGroup?,
  val fastPath: Boolean,
)

internal fun logPortalEvent(
  event: String,
  portal: View,
  currentHostName: String?,
  details: String = "",
) {
  logReparentEvent(event) {
    "portal=${ReparentLogFormatter.summary(portal)} " +
      "currentHost=${ReparentLogFormatter.logValue(currentHostName)} $details"
  }
}

internal fun logHostEvent(
  event: String,
  host: View,
  hostName: String?,
  details: String = "",
) {
  logReparentEvent(event) {
    "host=${ReparentLogFormatter.summary(host)} " +
      "hostName=${ReparentLogFormatter.logValue(hostName)} $details"
  }
}

internal fun logMoveDecision(decision: ReparentDecision) {
  logReparentEvent("move-decision") {
    val blockers = ReparentLogFormatter.fastPathBlockers(decision)
    "portal=${ReparentLogFormatter.summary(decision.portal)} " +
      "currentHost=${ReparentLogFormatter.logValue(decision.currentHostName)} " +
      "child=${ReparentLogFormatter.summary(decision.child)} " +
      "source=${ReparentLogFormatter.summary(decision.source)} " +
      "target=${ReparentLogFormatter.summary(decision.target)} " +
      "path=${if (decision.fastPath) "fast" else "fallback"} " +
      "blockers=${if (blockers.isEmpty()) "none" else blockers.joinToString(",")} " +
      "textures=${ReparentLogFormatter.textureSummary(decision.child)}"
  }
}

internal fun logMoveResult(
  child: View,
  operation: String,
) {
  logReparentEvent("move-result") {
    "operation=$operation child=${ReparentLogFormatter.summary(child)} " +
      "parent=${ReparentLogFormatter.summary(child.parent as? View)} " +
      "textures=${ReparentLogFormatter.textureSummary(child)}"
  }
}

internal fun logAttachDecision(
  parent: ViewGroup,
  parentName: String?,
  child: View,
  fastPath: Boolean,
) {
  logReparentEvent("attach-decision") {
    "parent=${ReparentLogFormatter.summary(parent)} " +
      "parentName=${ReparentLogFormatter.logValue(parentName)} " +
      "child=${ReparentLogFormatter.summary(child)} " +
      "path=${if (fastPath) "fast" else "regular"} " +
      "textures=${ReparentLogFormatter.textureSummary(child)}"
  }
}

internal fun logReparentPrimitive(
  operation: String,
  parent: ViewGroup,
  child: View,
  phase: String,
) {
  logReparentEvent("reparent-primitive") {
    "operation=$operation phase=$phase parent=${ReparentLogFormatter.summary(parent)} " +
      "child=${ReparentLogFormatter.summary(child)} " +
      "textures=${ReparentLogFormatter.textureSummary(child)}"
  }
}

private inline fun logReparentEvent(
  event: String,
  message: () -> String,
) {
  if (!Log.isLoggable(REPARENT_LOG_TAG, Log.DEBUG)) return

  Log.d(
    REPARENT_LOG_TAG,
    "seq=${eventSequence.incrementAndGet()} event=$event ${message()}".trimEnd(),
  )
}

private object ReparentLogFormatter {
  fun fastPathBlockers(decision: ReparentDecision): List<String> {
    val target = decision.target ?: return listOf("no-target")
    val blockers = mutableListOf<String>()
    if (decision.source !is ReparentableReactViewGroup) blockers.add("unsupported-source")
    if (decision.source === target) blockers.add("same-parent")
    if (!decision.child.isAttachedToWindow) blockers.add("child-detached")
    if (!target.isAttachedToWindow) blockers.add("target-detached")
    if (decision.source.rootView !== target.rootView) blockers.add("different-root")
    if (decision.child.hasFocus()) blockers.add("child-has-focus")
    if (decision.source.layoutTransition != null) blockers.add("source-layout-transition")
    if (target.layoutTransition != null) blockers.add("target-layout-transition")
    return blockers
  }

  fun summary(view: View?): String {
    if (view == null) return "null"

    val parentView = view.parent as? View
    return "${view.javaClass.simpleName}(id=${view.id},obj=${identity(view)}," +
      "attached=${view.isAttachedToWindow},root=${identity(view.rootView)}," +
      "window=${identity(view.windowToken)},parent=${identity(parentView)}," +
      "focused=${view.hasFocus()}," +
      "layoutTransition=${(view as? ViewGroup)?.layoutTransition != null})"
  }

  fun textureSummary(root: View): String {
    val textures = mutableListOf<TextureView>()
    collectTextureViews(root, textures)
    if (textures.isEmpty()) return "none"

    return textures.joinToString(prefix = "[", postfix = "]") { texture ->
      "TextureView(obj=${identity(texture)},attached=${texture.isAttachedToWindow}," +
        "available=${texture.isAvailable},opaque=${texture.isOpaque}," +
        "surface=${identity(texture.surfaceTexture)})"
    }
  }

  fun logValue(value: String?): String = value?.replace(' ', '_') ?: "null"

  private fun collectTextureViews(
    view: View,
    result: MutableList<TextureView>,
  ) {
    if (view is TextureView) result.add(view)
    if (view !is ViewGroup) return

    for (index in 0 until view.childCount) {
      view.getChildAt(index)?.let { collectTextureViews(it, result) }
    }
  }

  private fun identity(value: Any?): String =
    if (value == null) {
      "null"
    } else {
      Integer.toHexString(System.identityHashCode(value))
    }
}
