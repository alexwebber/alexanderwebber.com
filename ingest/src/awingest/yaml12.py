"""Owner YAML, read with YAML 1.2 core-schema rules: the same values the site's build sees.

PyYAML implements YAML 1.1, where an unquoted ``3:30:00`` is the integer 12600, ``2027-04-04`` is a
``datetime.date``, ``010`` is 8 and ``no`` is False. The site (yaml 2.x) reads all of those as
YAML 1.2 does, so owner files must mean the same thing to the processor. Duplicate keys are an
error, as they are on the site.
"""

import re
from typing import Any

import yaml
from yaml.constructor import ConstructorError


class _Loader(yaml.SafeLoader):
    pass


_Loader.yaml_implicit_resolvers = {}
_Loader.add_implicit_resolver(
    "tag:yaml.org,2002:null", re.compile(r"^(?:~|null|Null|NULL|)$"), ["~", "n", "N", ""]
)
_Loader.add_implicit_resolver(
    "tag:yaml.org,2002:bool",
    re.compile(r"^(?:true|True|TRUE|false|False|FALSE)$"),
    list("tTfF"),
)
_Loader.add_implicit_resolver(
    "tag:yaml.org,2002:int",
    re.compile(r"^(?:[-+]?[0-9]+|0o[0-7]+|0x[0-9a-fA-F]+)$"),
    list("-+0123456789"),
)
_Loader.add_implicit_resolver(
    "tag:yaml.org,2002:float",
    re.compile(
        r"^(?:[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)(?:[eE][-+]?[0-9]+)?"
        r"|[-+]?\.(?:inf|Inf|INF)|\.(?:nan|NaN|NAN))$"
    ),
    list("-+0123456789."),
)


def _construct_int(loader: _Loader, node: yaml.ScalarNode) -> int:
    text = loader.construct_scalar(node)
    # Base 10 unless prefixed: YAML 1.2 has no 1.1-style "010" octal.
    return int(text, 0) if text.startswith(("0o", "0x")) else int(text, 10)


def _construct_mapping(loader: _Loader, node: yaml.MappingNode) -> dict[Any, Any]:
    loader.flatten_mapping(node)
    result: dict[Any, Any] = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node, deep=True)
        if key in result:
            raise ConstructorError(None, None, f"duplicate key {key!r}", key_node.start_mark)
        result[key] = loader.construct_object(value_node, deep=True)
    return result


_Loader.add_constructor("tag:yaml.org,2002:int", _construct_int)
_Loader.add_constructor("tag:yaml.org,2002:map", _construct_mapping)


def load(text: str) -> Any:
    """Parses one YAML document with YAML 1.2 core-schema rules."""
    return yaml.load(text, Loader=_Loader)
