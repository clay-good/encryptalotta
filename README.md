# encryptalotta.com

**PGP Key Generation, File Encryption & Decryption**

A completely client-side PGP encryption tool for generating keys and encrypting/decrypting files. No server uploads, 100% private and open source.

**Inspired by [Kevin Qiu](https://www.linkedin.com/in/kevinmqiu)**

**Live Site:** [encryptalotta.com](https://encryptalotta.com)

## Features

- **Generate PGP Keys** - Create RSA or ECC key pairs with customizable settings
- **Encrypt Files** - Encrypt files with PGP public keys
- **Decrypt Files** - Decrypt files with your private key
- **100% Client-Side** - All operations happen in your browser
- **No Server Uploads** - Your files and keys never leave your device
- **Open Source** - Audit the code yourself

## Technology

- Pure HTML, CSS, and JavaScript
- [OpenPGP.js](https://openpgpjs.org/) v5.11.1 for encryption
- No frameworks, no build process
- Single file deployment

## Security Features

- Client-side only processing
- No data sent to any server
- Explicit warnings about key backup
- File size warnings to prevent browser crashes
- Support for multiple file encryption/decryption

## Key Generation Options

- **Algorithms:** RSA (2048/3072/4096 bits) or ECC (Curve25519)
- **Expiration:** Never, 1, 2, or 5 years
- **Passphrase protection** for private keys
- Download keys individually or together

## File Size Recommendations

- **Under 100MB:** Optimal performance
- **100MB - 500MB:** May be slow
- **Over 500MB:** Risk of browser crashes
- **Over 1GB:** Not recommended

## Development

This is a single-file application. Simply open `index.html` in a web browser or deploy to any static hosting service.

## Contributing

Contributions are welcome! Please submit pull requests or open issues on [GitHub](https://github.com/clay-good/encryptalotta).

## Deployment

1. Clone the repository
2. Deploy the entire directory to your static hosting provider
3. Ensure all files are served with proper MIME types

## Deployment to Cloudflare Pages

This site is optimized for Cloudflare Pages deployment:

1. Fork or clone this repository
2. Connect to Cloudflare Pages
3. Deploy - no build command needed (static HTML)
4. Done!

## Files

- `index.html` - Main application (single-file, no dependencies)
- `encryptalotta.png` - Logo
- `favicon-*.png` - Favicon files
- `apple-touch-icon.png` - iOS home screen icon
- `site.webmanifest` - Web app manifest
- `robots.txt` - Search engine directives
- `sitemap.xml` - Site map for SEO

## License

Open source - please audit and contribute!

## Important Security Notes

**Key Backup:** If you lose your private key, you cannot decrypt your files. Ever.

**Key Security:** Never share your private key with anyone.

**Browser Security:** This tool is only as secure as your browser environment.

## Support

For issues, questions, or contributions, please visit the [GitHub repository](https://github.com/clay-good/encryptalotta).
