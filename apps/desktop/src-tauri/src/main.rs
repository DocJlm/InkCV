#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use keyring::v1::Entry;
use serde::Serialize;

const KEYRING_SERVICE: &str = "app.inkcv.desktop";
const KEYRING_USER: &str = "ai-api-key";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CredentialRead {
    key: Option<String>,
    available: bool,
}

fn credential_entry() -> Result<Entry, ()> {
    Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(|_| ())
}

#[tauri::command]
fn read_ai_key() -> CredentialRead {
    match credential_entry() {
        Ok(entry) => CredentialRead {
            key: entry.get_password().ok(),
            available: true,
        },
        Err(()) => CredentialRead {
            key: None,
            available: false,
        },
    }
}

#[tauri::command]
fn write_ai_key(key: String) -> bool {
    credential_entry()
        .and_then(|entry| entry.set_password(&key).map_err(|_| ()))
        .is_ok()
}

#[tauri::command]
fn delete_ai_key() -> bool {
    credential_entry()
        .and_then(|entry| entry.delete_credential().map_err(|_| ()))
        .is_ok()
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            read_ai_key,
            write_ai_key,
            delete_ai_key
        ])
        .run(tauri::generate_context!())
        .expect("error while running InkCV");
}
