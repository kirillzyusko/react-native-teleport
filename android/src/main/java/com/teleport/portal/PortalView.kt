package com.teleport.portal

import android.content.Context
import android.view.View
import android.view.ViewGroup
import com.facebook.react.views.view.ReactViewGroup
import com.teleport.host.PortalHostView

class PortalView(context: Context) : ReactViewGroup(context) {
  private var hostName: String? = null

  fun setHostName(name: String?) {
    val children = mutableListOf<View>()
    val count = childCount
    for (i in count - 1 downTo 0) {
      val child = getChildAt(i) ?: continue
      children.add(0, child)
      removeViewAt(i)
    }

    hostName = name

    val target: ViewGroup = if (hostName != null) {
      findHost(hostName) ?: this
    } else {
      this
    }

    for (child in children) {
      target.addView(child)
    }

    requestLayout()
  }

  private fun findHost(name: String?): PortalHostView? {
    if (name == null) return null
    val root = rootView as? ViewGroup ?: return null
    val view = root.findViewWithTag<View>(name)
    return if (view is PortalHostView) view else null
  }

  private fun isTeleported(): Boolean {
    return hostName != null && findHost(hostName) != null
  }

  override fun getChildCount(): Int {
    return if (isTeleported()) {
      findHost(hostName)?.childCount ?: 0
    } else {
      super.getChildCount()
    }
  }

  override fun getChildAt(index: Int): View? {
    return if (isTeleported()) {
      findHost(hostName)?.getChildAt(index)
    } else {
      super.getChildAt(index)
    }
  }

  override fun addView(child: View, index: Int) {
    if (isTeleported()) {
      findHost(hostName)?.addView(child, index) ?: super.addView(child, index)
    } else {
      super.addView(child, index)
    }
  }

  override fun addView(child: View, index: Int, params: ViewGroup.LayoutParams) {
    if (isTeleported()) {
      findHost(hostName!!)?.addView(child, index, params) ?: super.addView(child, index, params)
    } else {
      super.addView(child, index, params)
    }
  }

  override fun removeView(view: View) {
    if (isTeleported()) {
      findHost(hostName)?.removeView(view) ?: super.removeView(view)
    } else {
      super.removeView(view)
    }
  }

  override fun removeViewAt(index: Int) {
    if (isTeleported()) {
      findHost(hostName)?.removeViewAt(index) ?: super.removeViewAt(index)
    } else {
      super.removeViewAt(index)
    }
  }
}
