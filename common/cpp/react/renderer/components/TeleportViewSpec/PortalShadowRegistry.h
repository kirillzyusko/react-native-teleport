#pragma once

#include <react/renderer/core/LayoutableShadowNode.h>

#include <string>
#include <unordered_map>
#include <unordered_set>
#include <mutex>
#include <memory>

namespace facebook::react
{

  class PortalShadowRegistry
  {
  public:
    static PortalShadowRegistry &getInstance()
    {
      static PortalShadowRegistry instance;
      return instance;
    }

    void registerHost(const std::string &name, const LayoutableShadowNode *host);
    void unregisterHost(const std::string &name);
    const LayoutableShadowNode *getHost(const std::string &name) const;

    // Portal node registration (using ShadowNodeFamily for stable identity)
    void registerPortal(const ShadowNodeFamily *family);
    void unregisterPortal(const ShadowNodeFamily *family);
    std::unordered_set<const ShadowNodeFamily *> getPortalFamilies() const;

  private:
    PortalShadowRegistry() = default;
    mutable std::mutex mutex_;
    std::unordered_map<std::string, const LayoutableShadowNode *> hosts_;
    std::unordered_set<const ShadowNodeFamily *> portalFamilies_;
  };

} // namespace facebook::react
