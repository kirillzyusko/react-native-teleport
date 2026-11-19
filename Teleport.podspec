require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "Teleport"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported, :tvos => min_ios_version_supported }
  s.source       = { :git => "https://github.com/kirillzyusko/react-native-teleport.git", :tag => "#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,cpp}"
  s.private_header_files = "ios/**/*.h"


  install_modules_dependencies(s)

  # `RuntimeScheduler.h` and the headers it includes belong to pods that
  # `install_modules_dependencies` doesn't expose to a pod built as a framework
  if ENV["USE_FRAMEWORKS"]
    add_dependency(s, "React-runtimescheduler")
    add_dependency(s, "React-performancetimeline")
    add_dependency(s, "React-jsinspectortracing", :framework_name => "jsinspector_moderntracing")
  end

  s.subspec "common" do |ss|
    ss.source_files         = ["common/cpp/**/*.{cpp,h}"]
    ss.header_dir           = "react/renderer/components/TeleportViewSpec"
    ss.private_header_files = "common/cpp/**/*.{h}"
    ss.pod_target_xcconfig  = { "HEADER_SEARCH_PATHS" => "\"$(PODS_TARGET_SRCROOT)/common/cpp\"" }
  end
end
