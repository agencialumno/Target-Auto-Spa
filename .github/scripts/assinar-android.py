"""Injeta a assinatura de release em src-tauri/gen/android/app/build.gradle.kts.

Dentro do bloco `android { }`, o nome `java` resolve para a extensão `java` do Gradle e não para
o pacote `java.*`. Por isso o bloco usa nomes simples (Properties, FileInputStream), com os
imports no topo do arquivo.
"""
import sys

p = sys.argv[1] if len(sys.argv) > 1 else 'src-tauri/gen/android/app/build.gradle.kts'
s = open(p, encoding='utf8').read()

signing = '''    signingConfigs {
        create("release") {
            val props = Properties().apply {
                FileInputStream(rootProject.file("keystore.properties")).use { load(it) }
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

# Imports ficam no topo do arquivo; o template do Tauri já pode trazer java.util.Properties
faltando = [
    i for i in ('import java.util.Properties', 'import java.io.FileInputStream')
    if i not in s
]
if faltando:
    s = '\n'.join(faltando) + '\n' + s

open(p, 'w', encoding='utf8').write(s)
