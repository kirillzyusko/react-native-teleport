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
  if (it == hosts_.end()) return nullptr;

  auto shared = it->second.lock();
  if (shared) return shared;

  hosts_.erase(it);
  return nullptr;
}

void PortalShadowRegistry::registerPortal(const std::string& hostName, std::shared_ptr<PortalViewShadowNode> portalNode) {
  if (hostName.empty()) return;

  std::lock_guard<std::mutex> lock(mutex_);
  portals_[hostName].push_back(portalNode);
}

std::vector<std::shared_ptr<PortalViewShadowNode>> PortalShadowRegistry::getPortals(const std::string& hostName) const {
  if (hostName.empty()) return {};

  std::lock_guard<std::mutex> lock(mutex_);
  auto it = portals_.find(hostName);
  if (it == portals_.end()) return {};

  std::vector<std::shared_ptr<PortalViewShadowNode>> activePortals;
  auto& weakList = it->second;
  for (auto weakIt = weakList.begin(); weakIt != weakList.end(); ) {
    auto shared = weakIt->lock();
    if (shared) {
      activePortals.push_back(shared);
      ++weakIt;
    } else {
      weakIt = weakList.erase(weakIt);
    }
  }
  return activePortals;
}

std::vector<std::string> PortalShadowRegistry::getActiveHostNames() const {
  std::lock_guard<std::mutex> lock(mutex_);
  std::vector<std::string> hostNames;
  for (auto it = hosts_.begin(); it != hosts_.end(); ) {
    auto shared = it->second.lock();
    if (shared) {
      hostNames.push_back(it->first);
      ++it;
    } else {
      it = hosts_.erase(it);
    }
  }
  return hostNames;
}

} // namespace facebook::react
