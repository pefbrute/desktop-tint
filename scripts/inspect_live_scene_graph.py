#!/usr/bin/env python3
import subprocess
import json

def inspect_live_scene_graph():
    print("==========================================================")
    print("      LIVE SCENE GRAPH & GEOMETRY DUMP (DBUS EVAL)        ")
    print("==========================================================")

    js_code = """
    (function() {
        try {
            let dock = Main.extensionManager.lookup('right-dock')?.stateObj;
            if (!dock) return JSON.stringify({ error: 'RightDock extension stateObj not found' });

            let root = dock._dockContainer;
            let appsBox = dock._appsBox;
            if (!root) return JSON.stringify({ error: '_dockContainer is null' });

            let getActorDetails = (actor) => {
                if (!actor) return null;
                let [x, y] = [0, 0];
                let [w, h] = [0, 0];
                try { [x, y] = actor.get_transformed_position(); } catch(_) {}
                try { [w, h] = actor.get_transformed_size(); } catch(_) {}
                return {
                    class: actor.style_class || actor.constructor.name,
                    visible: actor.visible,
                    mapped: actor.mapped,
                    reactive: actor.reactive,
                    opacity: actor.opacity,
                    translation_x: actor.translation_x,
                    pos: [Math.round(x), Math.round(y)],
                    size: [Math.round(w), Math.round(h)],
                };
            };

            let children = [];
            if (appsBox) {
                for (let child of appsBox.get_children()) {
                    children.push({
                        appId: child._rightDockAppId || child.style_class || 'actor',
                        details: getActorDetails(child)
                    });
                }
            }

            return JSON.stringify({
                root: getActorDetails(root),
                appsBox: getActorDetails(appsBox),
                totalAppIcons: dock._appIconMap ? dock._appIconMap.size : 0,
                appsBoxChildrenCount: appsBox ? appsBox.get_n_children() : 0,
                appsBoxChildren: children
            });
        } catch (e) {
            return JSON.stringify({ error: e.message, stack: e.stack });
        }
    })();
    """

    cmd = ["busctl", "--user", "call", "org.gnome.Shell", "/org/gnome/Shell", "org.gnome.Shell", "Eval", "s", js_code]
    res = subprocess.run(cmd, capture_output=True, text=True)

    if res.returncode == 0 and res.stdout:
        output_str = res.stdout.strip()
        # Clean busctl tuple output format b true "json_str"
        if 'b true "' in output_str:
            json_payload = output_str.split('b true "', 1)[1].rsplit('"', 1)[0]
            json_payload = json_payload.replace('\\"', '"').replace('\\\\', '\\')
            try:
                data = json.loads(json_payload)
                print(json.dumps(data, indent=2, ensure_ascii=False))
            except Exception as e:
                print("Raw output:", output_str)
        else:
            print("Raw output:", output_str)
    else:
        print("DBus call failed or returned empty. Stderr:", res.stderr)

    print("==========================================================")

if __name__ == "__main__":
    inspect_live_scene_graph()
