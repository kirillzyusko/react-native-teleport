#pragma once

#include <string>
#include <unordered_map>
#include <mutex>
#include <memory>

namespace facebook::react
{

  class LayoutableShadowNode;

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

  private:
    PortalShadowRegistry() = default;
    mutable std::mutex mutex_;
    std::unordered_map<std::string, const LayoutableShadowNode *> hosts_;
  };

} // namespace facebook::react
