from typing import Any, Dict, List, Optional
from abc import ABC, abstractmethod


class BaseLLMProvider(ABC):
    @abstractmethod
    def complete(self, prompt: str, **kwargs: Any) -> str:
        pass


class BaseImageProvider(ABC):
    @abstractmethod
    def generate_image(self, prompt: str, **kwargs: Any) -> str:
        pass


class BaseVideoProvider(ABC):
    @abstractmethod
    def generate_video(self, prompt: str, **kwargs: Any) -> str:
        pass


class BaseTTSProvider(ABC):
    @abstractmethod
    def synthesize_speech(self, text: str, **kwargs: Any) -> str:
        pass


class ToolRegistry:
    """Pluggable provider & tool registry for SSRStudio v2.

    Registers Local Deterministic Director and Local Animatic Provider as active,
    and maintains adapter stubs for external AI generation services.
    """

    def __init__(self) -> None:
        self._tools: Dict[str, Dict[str, Any]] = {}
        self._adapters: Dict[str, Any] = {}
        self._initialize_default_registry()

    def _initialize_default_registry(self) -> None:
        # 1. Local Active Engines (No external API key needed)
        self.register_adapter(
            tool_id="local_deterministic_director",
            name="Local Deterministic Director",
            category="director",
            mode="local_active",
            description="Rule and template-driven director engine for 5-stage funnel and shot breakdown",
            metadata={"offline": True, "provider_class": "GuidedDirectorService"},
        )
        self.register_adapter(
            tool_id="local_animatic_slate",
            name="Local Animatic Slate Generator",
            category="video_generation",
            mode="local_active",
            description="Pillow-based 2.39:1 anamorphic technical animatic slate generator with rule-of-thirds and vectors",
            metadata={"offline": True, "provider_class": "LocalAnimaticProvider"},
        )

        # 2. External Provider Adapter Stubs (Ready for zero-code key plug-in)
        self.register_adapter(
            tool_id="nano_banana_pro",
            name="Nano Banana Pro Image Adapter",
            category="image_generation",
            mode="adapter_stub_ready",
            description="High-fidelity character turnaround and headless sheet generator stub",
            metadata={"model": "nano-banana-pro-v1", "requires_key": True},
        )
        self.register_adapter(
            tool_id="soul_2_0",
            name="Soul 2.0 Photorealistic Portrait Adapter",
            category="image_generation",
            mode="adapter_stub_ready",
            description="Extreme micro-expression and skin texture portrait stub",
            metadata={"model": "soul-2.0", "requires_key": True},
        )
        self.register_adapter(
            tool_id="seedream_4_5",
            name="Seedream 4.5 Cinematic Composition Adapter",
            category="image_generation",
            mode="adapter_stub_ready",
            description="2.39:1 anamorphic environment and prop contact sheet stub",
            metadata={"model": "seedream-4.5", "requires_key": True},
        )
        self.register_adapter(
            tool_id="seedance_2_5",
            name="Seedance 2.5 Cinema Video Adapter",
            category="video_generation",
            mode="adapter_stub_ready",
            description="Higgsfield Hell-Grind 10-section multi-prompt video generator stub",
            metadata={"model": "seedance-2.5", "requires_key": True},
        )
        self.register_adapter(
            tool_id="seedance_2_0",
            name="Seedance 2.0 Base Video Adapter",
            category="video_generation",
            mode="adapter_stub_ready",
            description="Seedance legacy motion model stub",
            metadata={"model": "seedance-2.0", "requires_key": True},
        )
        self.register_adapter(
            tool_id="elevenlabs_tts",
            name="ElevenLabs Voice Synthesis Adapter",
            category="tts_audio",
            mode="adapter_stub_ready",
            description="Phonetic voice-lock speech synthesis stub",
            metadata={"model": "eleven_multilingual_v2", "requires_key": True},
        )

    def register_adapter(
        self,
        tool_id: str,
        name: str,
        category: str,
        mode: str = "adapter_stub_ready",
        description: str = "",
        metadata: Optional[Dict[str, Any]] = None,
        adapter_instance: Optional[Any] = None,
    ) -> None:
        self._tools[tool_id] = {
            "id": tool_id,
            "name": name,
            "category": category,
            "mode": mode,  # "local_active" | "adapter_stub_ready" | "connected"
            "description": description,
            "metadata": metadata or {},
        }
        if adapter_instance is not None:
            self._adapters[tool_id] = adapter_instance

    def get_tool(self, tool_id: str) -> Optional[Dict[str, Any]]:
        return self._tools.get(tool_id)

    def get_adapter_instance(self, tool_id: str) -> Optional[Any]:
        return self._adapters.get(tool_id)

    def list_tools(self, category: Optional[str] = None) -> List[Dict[str, Any]]:
        if category:
            return [t for t in self._tools.values() if t["category"] == category]
        return list(self._tools.values())
