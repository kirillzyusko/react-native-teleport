#pragma once

#include <memory>
#include <mutex>
#include <string>
#include <unordered_map>

#include <react/renderer/core/ShadowNode.h>

#include "RNTPortalViewShadowNode.h"
#include "RNTPortalHostViewShadowNode.h"

namespace facebook::react {

class PortalShadowRegistry {
 public:
  static PortalShadowRegistry& shared();

  void registerHost(const std::string& name, std::shared_ptr<PortalHostViewShadowNode> hostNode);
  std::shared_ptr<PortalHostViewShadowNode> getHost(const std::string& name) const;
  void registerPortal(const std::string& hostName, std::shared_ptr<PortalViewShadowNode> portalNode);
  std::vector<std::shared_ptr<PortalViewShadowNode>> getPortals(const std::string& hostName) const;
  std::vector<std::string> getActiveHostNames() const;

 private:
  PortalShadowRegistry() = default;

  mutable std::mutex mutex_;
  mutable std::unordered_map<std::string, std::weak_ptr<PortalHostViewShadowNode>> hosts_;
  mutable std::unordered_map<std::string, std::vector<std::weak_ptr<PortalViewShadowNode>>> portals_;
};

} // namespace facebook::react
