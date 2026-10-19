"""Injeta a assinatura de release em src-tauri/gen/android/app/build.gradle.kts."""
p = 'src-tauri/gen/android/app/build.gradle.kts'
s = open(p, encoding='utf8').read()

signing = '''    signingConfigs {
        create("release") {
            val props = java.util.Properties().apply {
                load(java.io.FileInputStream(rootProject.file("keystore.properties")))
            }
            storeFile = file(props.getProperty("storeFile"))
            storePassword = props.getProperty("storePassword")
            keyAlias = props.getProperty("keyAlias")
            keyPassword = props.getProperty("keyPassword")
        }
    }
    buildTypes {'''

assert '    buildTypes {' in s, 'buildTypes não encontrado'
s = s.replace('    buildTypes {', signing, 1)
assert 'getByName("release") {' in s, 'bloco release não encontrado'
s = s.replace(
    'getByName("release") {',
    'getByName("release") {\n            signingConfig = signingConfigs.getByName("release")',
    1,
)
open(p, 'w', encoding='utf8').write(s)
