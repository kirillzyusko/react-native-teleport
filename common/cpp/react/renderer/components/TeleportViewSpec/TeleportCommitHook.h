//
//  TeleportCommitHook.h
//  Pods
//
//  Created by Kiryl Ziusko on 07/10/2025.
//

#pragma once

#include "PortalShadowRegistry.h"
#include <react/renderer/uimanager/UIManager.h>
#include <react/renderer/uimanager/UIManagerCommitHook.h>

using namespace facebook::react;

namespace teleport {

class TeleportCommitHook : public UIManagerCommitHook {
 public:
  TeleportCommitHook(const std::shared_ptr<UIManager> &uiManager);

  ~TeleportCommitHook() noexcept override;

  void commitHookWasRegistered(UIManager const &) noexcept override {}

  void commitHookWasUnregistered(UIManager const &) noexcept override {}

  RootShadowNode::Unshared shadowTreeWillCommit(
      ShadowTree const &shadowTree,
      RootShadowNode::Shared const &oldRootShadowNode,
      RootShadowNode::Unshared const &newRootShadowNode)
    noexcept override;
    
 private:
  std::shared_ptr<UIManager> uiManager_;
};

}
