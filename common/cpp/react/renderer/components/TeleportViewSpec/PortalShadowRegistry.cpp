#include "PortalShadowRegistry.h"

namespace facebook::react {

PortalShadowRegistry& PortalShadowRegistry::shared() {
  static PortalShadowRegistry instance;
  return instance;
}

void PortalShadowRegistry::registerHost(const std::string& name, std::shared_ptr<PortalHostViewShadowNode> hostNode) {
  if (name.empty()) return;

  std::lock_guard<std::mutex> lock(mutex_);
  hosts_[name] = hostNode;
}

std::shared_ptr<PortalHostViewShadowNode> PortalShadowRegistry::getHost(const std::string& name) const {
  if (name.empty()) return nullptr;

  std::lock_guard<std::mutex> lock(mutex_);
  auto it = hosts_.find(name);
  if (it != hosts_.end()) {
    auto shared = it->second.lock();
    if (shared) {
      return shared;
    }
    hosts_.erase(it);
  }
  return nullptr;
}

} // namespace facebook::react
