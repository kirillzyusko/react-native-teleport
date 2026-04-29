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

    pendingPortals[name]?.let { portals ->
      val iterator = portals.iterator()
      while (iterator.hasNext()) {
        val portalRef = iterator.next()
        portalRef.get()?.onHostAvailable() ?: iterator.remove()
      }
      // Intentionally do NOT remove the pending list here. Portals stay
      // subscribed to this hostname so they can re-bind when the host is
      // re-mounted (e.g. NativeStack pop unmounted the screen hosting
      // <PortalHost> and a subsequent push mounts a fresh one). The
      // WeakReference cleanup in the iterator above prunes dead portals,
      // so leaving the list populated does not leak. Portals also
      // unsubscribe explicitly when their hostName changes — see
      // PortalView.setHostName.
    }
  }

  fun unregisterHost(
    name: String,
    viewId: Int,
  ) {
    val hostViewId = hosts[name]?.get()?.id
    if (hostViewId == viewId) {
      hosts.remove(name)
    }
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
