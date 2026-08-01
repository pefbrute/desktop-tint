#!/usr/bin/env python3
import subprocess

def reset_extension_error():
    print("==========================================================")
    print("      RESETTING GNOME SHELL EXTENSION INTERNAL STATE      ")
    print("==========================================================")

    eval_script = '''
    let ext = Main.extensionManager.lookup("right-dock@pasynkov");
    if (ext) {
        ext.state = 0;
        ext.error = "";
        Main.extensionManager.enableExtension("right-dock@pasynkov");
    }
    '''

    cmd = ["gdbus", "call", "--session", "--dest", "org.gnome.Shell", "--object-path", "/org/gnome/Shell", "--method", "org.gnome.Shell.Eval", eval_script]
    res = subprocess.run(cmd, capture_output=True, text=True)
    print("DBus Eval output:", res.stdout.strip())

    res_info = subprocess.run(["gnome-extensions", "info", "right-dock@pasynkov"], capture_output=True, text=True)
    print("\nUpdated Extension Info State:\n", res_info.stdout.strip())
    print("==========================================================")

if __name__ == "__main__":
    reset_extension_error()
