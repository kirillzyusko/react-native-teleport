#include "PortalShadowRegistry.h"

#include <string>

namespace facebook::react
{

  void PortalShadowRegistry::registerHost(
      const std::string &name,
      const LayoutableShadowNode *host)
  {
    std::lock_guard<std::mutex> lock(mutex_);
    hosts_[name] = host;
  }

  void PortalShadowRegistry::unregisterHost(const std::string &name)
  {
    std::lock_guard<std::mutex> lock(mutex_);
    hosts_.erase(name);
  }

  const LayoutableShadowNode *PortalShadowRegistry::getHost(
      const std::string &name) const
  {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = hosts_.find(name);
    if (it != hosts_.end())
    {
      return it->second;
    }
    return nullptr;
  }

  void PortalShadowRegistry::registerPortal(const ShadowNodeFamily *family)
  {
    std::lock_guard<std::mutex> lock(mutex_);
    portalFamilies_.insert(family);
  }

  void PortalShadowRegistry::unregisterPortal(const ShadowNodeFamily *family)
  {
    std::lock_guard<std::mutex> lock(mutex_);
    portalFamilies_.erase(family);
  }

  std::unordered_set<const ShadowNodeFamily*> PortalShadowRegistry::getPortalFamilies() const
  {
    std::lock_guard<std::mutex> lock(mutex_);
    return portalFamilies_;
  }

} // namespace facebook::react
