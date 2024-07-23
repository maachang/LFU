# LFUの初期化対応

やることを抜粋

1. LFUをローカル環境にデプロイする
2. LFUコマンドのセットアップ

## 1. LFUをローカル環境にデプロイする

GithubリポジトリにあるLFU環境をローカル環境にデプロイします.

※ `~/project` パスは環境に合わせて任意のディレクトリを指定します.<br>
　以降の説明より `~/project` ディレクトリ名として表現します.

### 方法１：対象の [Githubリポジトリ](https://github.com/maachang/LFU) からCloneする

~~~bash
cd ~/project
git clone git@github.com:maachang/LFU.git
~~~

### 方法２：LFUのzipファイルをダウンロードする

~~~bash
cd ~/project
wget https://github.com/maachang/LFU/archive/refs/heads/main.zip
unzip main.zip
rm -f main.zip
mv LFU-main LFU
~~~

## 2. LFUコマンドのセットアップ

LFUが提供しているコマンドを利用可能にします.

以下のファイルの末尾に追加します.

- ~/.profile or ~/.bashrc
~~~bash

export LFU_HOME=~/project/LFU
export PATH=${LFU_HOME}/simulator/bin:${PATH}
~~~
※ `~/.profile` or `~/.bashrc` のどちらかに設定が必要です.<br>
　また.bashrcは環境に合わせた先で設定してください(今回説明ではbashが対象) 

その後
~~~bash
source ~/.profile
or 
source ~/.bashrc
~~~

とする事で LFUが提供するコマンドが利用可能となります.


