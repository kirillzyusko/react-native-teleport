//
//  PortalHostView.mm
//  Pods
//
//  Created by Kiryl Ziusko on 02/09/2025.
//

#import "PortalHostView.h"
#import "PortalRegistry.h"

#import <react/renderer/components/reactnativeteleport/RNTPortalHostViewComponentDescriptor.h>
#import <react/renderer/components/TeleportViewSpec/EventEmitters.h>
#import <react/renderer/components/TeleportViewSpec/Props.h>
#import <react/renderer/components/TeleportViewSpec/RCTComponentViewHelpers.h>

#import "RCTFabricComponentsPlugins.h"

using namespace facebook::react;

@interface PortalHostView () <RCTPortalHostViewViewProtocol>

@property (nonatomic, strong) NSString *registeredName;

@end

@implementation PortalHostView

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<PortalHostViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const PortalHostViewProps>();
    _props = defaultProps;
  }

  return self;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
  const auto &oldViewProps = *std::static_pointer_cast<PortalHostViewProps const>(_props);
  const auto &newViewProps = *std::static_pointer_cast<PortalHostViewProps const>(props);

  if (oldViewProps.name != newViewProps.name) {
    std::string nameStr = newViewProps.name;
    NSString *newName = nameStr.empty() ? nil : [NSString stringWithUTF8String:nameStr.c_str()];

    if (![self.registeredName isEqualToString:newName]) {
      if (self.registeredName) {
        [[PortalRegistry sharedInstance] unregisterHostWithName:self.registeredName];
      }
      self.registeredName = newName;
      if (newName) {
        [[PortalRegistry sharedInstance] registerHost:self withName:newName];
      }
    }
  }

  [super updateProps:props oldProps:oldProps];
}

- (void)dealloc
{
  if (self.registeredName) {
    [[PortalRegistry sharedInstance] unregisterHostWithName:self.registeredName];
  }
}

Class<RCTComponentViewProtocol> PortalHostViewCls(void)
{
  return PortalHostView.class;
}

@end
