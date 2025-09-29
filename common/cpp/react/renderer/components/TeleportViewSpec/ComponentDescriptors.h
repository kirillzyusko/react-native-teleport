#pragma once

#include <react/renderer/components/TeleportViewSpec/ShadowNodes.h>
#include <react/renderer/core/ConcreteComponentDescriptor.h>
#include <react/renderer/componentregistry/ComponentDescriptorProviderRegistry.h>

#include <react/renderer/components/TeleportViewSpec/RNTPortalHostViewComponentDescriptor.h>
#include <react/renderer/components/TeleportViewSpec/RNTPortalViewComponentDescriptor.h>

namespace facebook::react
{

  void TeleportViewSpec_registerComponentDescriptorsFromCodegen(
      std::shared_ptr<const ComponentDescriptorProviderRegistry> registry);

} // namespace facebook::react