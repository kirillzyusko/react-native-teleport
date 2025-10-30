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

    // Notify all pending portals that their host is now available
    pendingPortals[name]?.let { portals ->
      val iterator = portals.iterator()
      while (iterator.hasNext()) {
        val portalRef = iterator.next()
        portalRef.get()?.onHostAvailable() ?: iterator.remove()
      }
      pendingPortals.remove(name)
    }
  }

  fun unregisterHost(name: String) {
    hosts.remove(name)
  }

  fun getHost(name: String?): PortalHostView? = hosts[name]?.get()

  fun registerPendingPortal(
    hostName: String,
    portal: PortalView,
  ) {
    val portals = pendingPortals.getOrPut(hostName) { mutableListOf() }
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
