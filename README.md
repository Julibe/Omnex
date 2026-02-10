# Omnex | The Asset Explorer. Everything. Accounted for.

**Omnex** is a high-performance, glassmorphic command center designed for the logical management and visual exploration of project assets. Developed with ❤️ by **Julibe**, it transforms raw directory structures into an interactive, 3D-accelerated ecosystem.

## 🚀 Vision
In modern development, assets often become a chaotic void. Omnex ensures that every file is not just stored, but is **accounted for**. By leveraging deterministic logic and atmospheric UI states, it provides a professional-grade interface for designers and developers to interact with their media vaults.

---

## 💎 Core Logic & Features

### 1. Deterministic Folder Coloring Engine
Unlike static themes, Omnex utilizes a cryptographic hash logic (`md5`) to generate unique hex codes for every folder. This ensures a consistent visual identity for specific sectors (e.g., your "Characters" folder will always be the same specific shade of blue across all sessions).

### 2. Atmospheric UI State Sync
The UI is built on a dynamic theme-injection pipeline. By passing a `color` variable through the URI, the entire CSS variable tree—including `--accent`, `--accent_glow`, and `--accent_border`—recalculates in real-time. This creates a total-immersion experience where the environment adapts to the selected asset sector.

### 3. Kinetic 3D Interaction Physics
Every asset card is a 3D object governed by:
* **Perspective Rotation:** Calculated based on the cursor's proximity to the element's center point.
* **Magnetic Attraction:** Icons within cards utilize a secondary "pull" logic to create a sense of depth and physical weight.
* **Glassmorphic Stack:** Utilizing `backdrop-filter` and `corner-shape: squircle` for a native app-like aesthetic.

### 4. Full-Fidelity Metadata & Analytics
The system is pre-configured with a massive metadata stack, including:
* **SEO & OpenGraph:** Optimized for visual sharing and indexing.
* **Tracking:** Pre-integrated hooks for Google Tag Manager (GTM), Google Analytics 4 (GA4), and Microsoft Clarity.
* **Firebase Logic:** Placeholder configuration for real-time notification extensions.

---

## 🛠️ Installation

1.  **Clone the Repository:**
    ```bash
    git clone [https://github.com/your-username/omnex.git](https://github.com/your-username/omnex.git)
    ```
2.  **Initialize Asset Vault:**
    Create a folder named `Assets` in the root directory.
    ```bash
    mkdir Assets
    ```
3.  **Deployment:**
    Serve the project via any PHP-enabled environment (Apache/Nginx). Ensure `mime_content_type` is enabled in your `php.ini` for full preview support.

---

## 📂 Logical Structure
* `index.php`: The primary execution engine and HTML renderer.
* `styles/styles.css`: Nested CSS architecture with dynamic variable injection.
* `script/script.js`: Verbose JavaScript handling 3D interactions and modal orchestration.
* `.gitignore`: Security logic to protect private asset data.

---

## 👨‍💻 Author
**Julian De Salvador (Julibe)** *Freelance Designer & Developer* [Portfolio](http://julibe.com/) | [GitHub](http://julibe.com/github) | [WhatsApp](http://julibe.com/whatsapp)

---
*Omnex. Everything. Accounted for.*