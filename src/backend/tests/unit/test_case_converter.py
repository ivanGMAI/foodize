import pytest

from utils.case_converter import camel_case_to_snake_case


class TestCamelToSnake:
    @pytest.mark.parametrize(
        "input_str, expected",
        [
            ("CamelCase", "camel_case"),
            ("camelCase", "camel_case"),
            ("HTTP", "http"),
            ("Simple", "simple"),
            ("", ""),
            ("already_snake", "already_snake"),
            ("MyHTTPSRequest", "my_https_request"),
            ("A", "a"),
            ("ABC", "abc"),
            ("getHTTPSUrl", "get_https_url"),
        ],
    )
    def test_conversion(self, input_str: str, expected: str):
        assert camel_case_to_snake_case(input_str) == expected
