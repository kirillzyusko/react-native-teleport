package com.teleport.global

import com.teleport.host.PortalHostView
import java.lang.ref.WeakReference

object PortalRegistry {
  private val hosts: MutableMap<String, WeakReference<PortalHostView>> = HashMap()

  fun register(
    name: String,
    view: PortalHostView,
  ) {
    hosts[name] = WeakReference(view)
  }

  fun unregister(name: String) {
    hosts.remove(name)
  }

  fun getHost(name: String?): PortalHostView? = hosts[name]?.get()
}
