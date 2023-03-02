# coc-lcov

A code coverage extention for coc that supports LCOV files.
I wrote this specifcally for my own Rust code, but should
work for any LCOV files.

To generate a compatible Rust coverage file you can use `cargo-tarpaulin`:

```
cargo tarpaulin --out lcov --output-dir target/debug
```

## Install

`:CocInstall coc-lcov` (not yet!)

## License

MIT

---

> This extension is built with [create-coc-extension](https://github.com/fannheyward/create-coc-extension)
