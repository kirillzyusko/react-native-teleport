package com.teleport.global

import com.teleport.host.PortalHostView
import com.teleport.portal.PortalView
import java.lang.ref.WeakReference

object PortalRegistry {
  private val hosts: MutableMap<String, WeakReference<PortalHostView>> = HashMap()
  private val pendingPortals: MutableMap<String, MutableList<WeakReference<PortalView>>> = HashMap()

  fun registerHost(
    name: String,
    view: PortalHostView,
  ) {
    hosts[name] = WeakReference(view)
    notifySubscribers(name)
  }

  fun unregisterHost(
    name: String,
    viewId: Int,
  ) {
    val hostViewId = hosts[name]?.get()?.id
    if (hostViewId == viewId) {
      hosts.remove(name)
      notifySubscribers(name)
    }
  }

  private fun notifySubscribers(name: String) {
    pendingPortals[name]?.let { portals ->
      val iterator = portals.iterator()
      while (iterator.hasNext()) {
        val portalRef = iterator.next()
        portalRef.get()?.onHostChanged() ?: iterator.remove()
      }
    }
  }

  fun getHost(name: String?): PortalHostView? = hosts[name]?.get()

  fun registerPendingPortal(
    hostName: String,
    portal: PortalView,
  ) {
    val portals = pendingPortals.getOrPut(hostName) { mutableListOf() }
    portals.removeAll { it.get() == null || it.get() == portal }
    portals.add(WeakReference(portal))
  }

  fun unregisterPendingPortal(
    hostName: String,
    portal: PortalView,
  ) {
    pendingPortals[hostName]?.let { portals ->
      portals.removeAll { it.get() == null || it.get() == portal }
      if (portals.isEmpty()) {
        pendingPortals.remove(hostName)
      }
    }
  }
}
