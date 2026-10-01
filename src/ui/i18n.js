/* Shared by the isolated renderer and native menus. No user content is translated. */
(function (root) {
  const languages = [['ru', 'Русский'], ['en', 'English'], ['ko', '한국어'], ['fr', 'Français'], ['ja', '日本語'], ['zh', '简体中文']];
  const locales = { ru: 'ru-RU', en: 'en-US', ko: 'ko-KR', fr: 'fr-FR', ja: 'ja-JP', zh: 'zh-CN' };
  // Russian key | English | Korean | French | Japanese | Simplified Chinese.
  const rows = `
Условия использования|Terms of use|이용 약관|Conditions d’utilisation|利用規約|使用条款
Конфиденциальность|Privacy|개인정보 보호|Confidentialité|プライバシー|隐私
Лицензии компонентов|Third-party licenses|구성 요소 라이선스|Licences des composants|コンポーネントのライセンス|组件许可证
Исходники MPL|MPL source code|MPL 소스 코드|Code source MPL|MPLソースコード|MPL源代码
Блюр фона виджета|Widget background blur|위젯 배경 흐림|Flou du fond du widget|ウィジェット背景のぼかし|小组件背景模糊
0% — выключен. Ползунок меняет плотность стекла; радиус размытия задаёт Windows.|0% — off. The slider changes glass density; Windows sets the blur radius.|0% — 꺼짐. 슬라이더는 유리 밀도를 조절하며 흐림 반경은 Windows에서 설정합니다.|0% — désactivé. Le curseur règle la densité du verre ; Windows définit le rayon du flou.|0% — オフ。スライダーはガラスの濃さを調整し、ぼかしの半径はWindowsが設定します。|0% — 关闭。滑块调节玻璃浓度，模糊半径由Windows设定。
Непрозрачность фона виджета. При включённом блюре смешивается со стеклом.|Widget background opacity. With blur enabled, it blends with glass.|위젯 배경 불투명도입니다. 흐림이 켜져 있으면 유리와 혼합됩니다.|Opacité du fond du widget. Lorsque le flou est activé, il se mélange au verre.|ウィジェット背景の不透明度。ぼかしが有効な場合、ガラスと混ざります。|小组件背景不透明度。启用模糊时与玻璃效果混合。
Системное размытие Acrylic. Чтобы видеть эффект, уменьшите непрозрачность фона.|System Acrylic blur. Reduce background opacity to see the effect.|시스템 Acrylic 흐림입니다. 효과를 보려면 배경 불투명도를 낮추세요.|Flou Acrylic du système. Réduisez l’opacité du fond pour voir l’effet.|システムのAcrylicぼかし。効果を見るには背景の不透明度を下げてください。|系统Acrylic模糊。降低背景不透明度以查看效果。
Редактировать|Edit|편집|Modifier|編集|编辑
Язык|Language|언어|Langue|言語|语言
Язык приложения и виджетов|App and widget language|앱 및 위젯 언어|Langue de l’application et des widgets|アプリとウィジェットの言語|应用和小组件的语言
Показывать календарь {name}|Show calendar {name}|{name} 캘린더 표시|Afficher le calendrier {name}|カレンダー「{name}」を表示|显示日历 {name}
Календарь|Calendar|캘린더|Calendrier|カレンダー|日历
Календари|Calendars|캘린더 목록|Calendriers|カレンダー一覧|日历列表
События|Events|일정|Événements|予定|日程
Событие|Event|일정|Événement|予定|日程
Новое событие|New event|새 일정|Nouvel événement|新しい予定|新建日程
Сегодня|Today|오늘|Aujourd’hui|今日|今天
сегодня|today|오늘|aujourd’hui|今日|今天
Настройки|Settings|설정|Paramètres|設定|设置
Оформление|Appearance|화면 설정|Apparence|外観|外观
Виджеты|Widgets|위젯|Widgets|ウィジェット|小组件
Виджеты рабочего стола|Desktop widgets|바탕 화면 위젯|Widgets du bureau|デスクトップウィジェット|桌面小组件
Ваш день. В одном месте.|Your day. In one place.|하루의 일정을 한곳에서.|Votre journée. Au même endroit.|一日の予定を、ひとつの場所に。|一天的安排，尽在一处。
Месяц|Month|월|Mois|月|月
Неделя|Week|주|Semaine|週|周
Назад|Back|이전|Précédent|前へ|上一个
Вперёд|Forward|다음|Suivant|次へ|下一个
Предыдущий месяц|Previous month|이전 달|Mois précédent|前の月|上个月
Следующий месяц|Next month|다음 달|Mois suivant|次の月|下个月
Весь день|All day|종일|Toute la journée|終日|全天
Все события месяца|All events this month|이번 달의 모든 일정|Tous les événements du mois|今月のすべての予定|本月所有日程
-часовой формат|-hour time|시간 형식| heures|時間表示|小时制
Добавить событие|Add event|일정 추가|Ajouter un événement|予定を追加|添加日程
＋ Добавить событие|＋ Add event|＋ 일정 추가|＋ Ajouter un événement|＋ 予定を追加|＋ 添加日程
＋ Событие|＋ Event|＋ 일정|＋ Événement|＋ 予定|＋ 日程
Вернуться к сегодняшнему дню|Go to today|오늘로 이동|Revenir à aujourd’hui|今日に戻る|返回今天
Открыть TimeLife|Open TimeLife|TimeLife 열기|Ouvrir TimeLife|TimeLifeを開く|打开 TimeLife
Убрать виджет|Hide widget|위젯 숨기기|Masquer le widget|ウィジェットを非表示|隐藏小组件
Показать виджет|Show widget|위젯 표시|Afficher le widget|ウィジェットを表示|显示小组件
Синхронизировать|Sync|동기화|Synchroniser|同期|同步
Выход|Quit|종료|Quitter|終了|退出
TimeLife — виджет|TimeLife — widget|TimeLife — 위젯|TimeLife — widget|TimeLife — ウィジェット|TimeLife — 小组件
Только чтение|Read-only|읽기 전용|Lecture seule|読み取り専用|只读
Локальный календарь|Local calendar|로컬 캘린더|Calendrier local|ローカルカレンダー|本地日历
На компьютере|On this computer|이 컴퓨터|Sur cet ordinateur|このコンピューター|此电脑
Без названия|Untitled|제목 없음|Sans titre|無題|无标题
Событий нет|No events|일정 없음|Aucun événement|予定はありません|暂无日程
Загрузка…|Loading…|불러오는 중…|Chargement…|読み込み中…|加载中…
Обновлено|Updated|업데이트됨|Mis à jour|更新|更新于
Ожидают отправки:|Pending uploads:|업로드 대기:|En attente d’envoi :|送信待ち：|待上传：
iCloud подключён|iCloud connected|iCloud 연결됨|iCloud connecté|iCloudに接続済み|已连接 iCloud
Подключите iCloud в настройках|Connect iCloud in Settings|설정에서 iCloud를 연결하세요|Connectez iCloud dans les paramètres|設定からiCloudに接続してください|请在设置中连接 iCloud
Не удалось обновить|Update failed|업데이트 실패|Échec de la mise à jour|更新できませんでした|更新失败
Синхронизация…|Syncing…|동기화 중…|Synchronisation…|同期中…|同步中…
Повторить|Retry|다시 시도|Réessayer|再試行|重试
Изменения на двух устройствах|Changes on two devices|두 기기의 변경 사항|Modifications sur deux appareils|2台のデバイスでの変更|两台设备上的更改
Изменения на двух устройствах:|Changes on two devices:|두 기기의 변경 사항:|Modifications sur deux appareils :|2台のデバイスでの変更：|两台设备上的更改：
Разрешить конфликты|Resolve conflicts|충돌 해결|Résoudre les conflits|競合を解決|解决冲突
Закрыть|Close|닫기|Fermer|閉じる|关闭
Название|Title|제목|Titre|タイトル|标题
Начало|Start|시작|Début|開始|开始
Конец|End|종료|Fin|終了|结束
(не включая)|(exclusive)|(포함하지 않음)|(non inclus)|(含まない)|(不含)
Часовой пояс|Time zone|시간대|Fuseau horaire|タイムゾーン|时区
Изменить|Edit|수정|Modifier|変更|编辑
Только это повторение|This occurrence only|이 일정만|Cette occurrence uniquement|この回のみ|仅此次日程
Всю серию|Entire series|전체 반복 일정|Toute la série|すべての繰り返し|整个系列
Повторение|Repeat|반복|Répétition|繰り返し|重复
Не повторять|Does not repeat|반복 안 함|Ne pas répéter|繰り返さない|不重复
Каждый день|Daily|매일|Tous les jours|毎日|每天
Каждую неделю|Weekly|매주|Toutes les semaines|毎週|每周
Каждый месяц|Monthly|매월|Tous les mois|毎月|每月
Каждый год|Yearly|매년|Tous les ans|毎年|每年
Своё правило (RRULE)|Custom rule (RRULE)|사용자 지정 규칙 (RRULE)|Règle personnalisée (RRULE)|カスタムルール（RRULE）|自定义规则（RRULE）
Правило RRULE|RRULE rule|RRULE 규칙|Règle RRULE|RRULEルール|RRULE 规则
Поддерживаются интервалы, дни недели, COUNT и UNTIL.|Supports intervals, weekdays, COUNT and UNTIL.|간격, 요일, COUNT 및 UNTIL을 지원합니다.|Intervalles, jours de la semaine, COUNT et UNTIL sont pris en charge.|間隔、曜日、COUNT、UNTILに対応しています。|支持间隔、星期、COUNT 和 UNTIL。
Место|Location|장소|Lieu|場所|地点
Заметки|Notes|메모|Notes|メモ|备注
Удалить|Delete|삭제|Supprimer|削除|删除
Сохранить|Save|저장|Enregistrer|保存|保存
Отмена|Cancel|취소|Annuler|キャンセル|取消
Удалить событие?|Delete event?|일정을 삭제할까요?|Supprimer l’événement ?|予定を削除しますか？|删除日程？
Будет удалено только выбранное повторение.|Only this occurrence will be deleted.|선택한 일정만 삭제됩니다.|Seule cette occurrence sera supprimée.|選択した回のみ削除されます。|仅删除此次日程。
Будет удалена вся серия, включая её повторения.|The entire series will be deleted.|전체 반복 일정이 삭제됩니다.|Toute la série sera supprimée.|すべての繰り返しが削除されます。|将删除整个系列及其重复日程。
Событие будет удалено из календаря.|The event will be deleted from the calendar.|캘린더에서 일정이 삭제됩니다.|L’événement sera supprimé du calendrier.|カレンダーから予定が削除されます。|将从日历中删除此日程。
После синхронизации изменение появится на iPhone.|The change will appear on your iPhone after syncing.|동기화 후 iPhone에 변경 사항이 표시됩니다.|La modification apparaîtra sur votre iPhone après la synchronisation.|同期後、変更がiPhoneに反映されます。|同步后，更改将显示在 iPhone 上。
Событие сохранено|Event saved|일정 저장됨|Événement enregistré|予定を保存しました|日程已保存
Событие удалено|Event deleted|일정 삭제됨|Événement supprimé|予定を削除しました|日程已删除
Тема|Theme|테마|Thème|テーマ|主题
Для приложения и всех виджетов|For the app and all widgets|앱 및 모든 위젯에 적용|Pour l’application et tous les widgets|アプリとすべてのウィジェットに適用|应用于应用和所有小组件
☼ Светлая|☼ Light|☼ 밝게|☼ Clair|☼ ライト|☼ 浅色
☾ Тёмная|☾ Dark|☾ 어둡게|☾ Sombre|☾ ダーク|☾ 深色
Непрозрачность светлого фона|Light background opacity|밝은 배경 불투명도|Opacité du fond clair|ライト背景の不透明度|浅色背景不透明度
Непрозрачность тёмного фона|Dark background opacity|어두운 배경 불투명도|Opacité du fond sombre|ダーク背景の不透明度|深色背景不透明度
0% — прозрачный, 100% — сплошной. Только фон виджета.|0% transparent, 100% opaque. Widget background only.|0%는 투명, 100%는 불투명입니다. 위젯 배경에만 적용됩니다.|0 % transparent, 100 % opaque. Uniquement le fond du widget.|0%で透明、100%で不透明。ウィジェットの背景のみ。|0% 为透明，100% 为不透明。仅影响小组件背景。
Выделение дня|Day highlight|날짜 강조|Surbrillance du jour|日のハイライト|日期高亮
5% чёрного в светлой теме, 5% белого в тёмной|5% black in light theme, 5% white in dark theme|밝은 테마는 검정 5%, 어두운 테마는 흰색 5%|5 % de noir en thème clair, 5 % de blanc en thème sombre|ライトでは黒5%、ダークでは白5%|浅色主题使用 5% 黑色，深色主题使用 5% 白色
Без виджета|No widget|위젯 없음|Aucun widget|ウィジェットなし|无小组件
Календарь и события|Calendar and events|캘린더와 일정|Calendrier et événements|カレンダーと予定|日历与日程
700 × 412 · горизонтальный|700 × 412 · horizontal|700 × 412 · 가로형|700 × 412 · horizontal|700 × 412 · 横型|700 × 412 · 横向
350 × 840 · вертикальный|350 × 840 · vertical|350 × 840 · 세로형|350 × 840 · vertical|350 × 840 · 縦型|350 × 840 · 纵向
Поверх других окон|Always on top|항상 위에 표시|Toujours au premier plan|常に最前面に表示|置于其他窗口之上
По умолчанию виджет находится на уровне обычного окна|By default, the widget behaves like a normal window|기본적으로 위젯은 일반 창처럼 표시됩니다|Par défaut, le widget se comporte comme une fenêtre normale|初期設定では通常のウィンドウとして表示されます|默认情况下，小组件按普通窗口显示
Перемещайте виджет за заголовок «Календарь». При наведении появятся кнопки открытия приложения и скрытия виджета.|Drag the widget by its Calendar title. Hover to reveal buttons to open the app or hide the widget.|캘린더 제목을 끌어 위젯을 이동하세요. 마우스를 올리면 앱 열기 및 위젯 숨기기 버튼이 나타납니다.|Déplacez le widget par son titre Calendrier. Survolez-le pour ouvrir l’application ou masquer le widget.|カレンダーの見出しをドラッグして移動できます。マウスを重ねると、アプリを開くボタンと非表示ボタンが表示されます。|拖动“日历”标题可移动小组件。悬停时会显示打开应用和隐藏小组件的按钮。
События показываются в выбранном часовом поясе|Events are shown in the selected time zone|선택한 시간대로 일정이 표시됩니다|Les événements sont affichés dans le fuseau choisi|選択したタイムゾーンで予定を表示します|日程按所选时区显示
Начало недели|First day of week|한 주의 시작|Premier jour de la semaine|週の開始日|每周第一天
Понедельник|Monday|월요일|Lundi|月曜日|星期一
Воскресенье|Sunday|일요일|Dimanche|日曜日|星期日
Суббота|Saturday|토요일|Samedi|土曜日|星期六
12-часовой формат|12-hour time|12시간 형식|Format 12 heures|12時間表示|12 小时制
Выключено — время в формате 24 часов|When off, use 24-hour time|끄면 24시간 형식을 사용합니다|Désactivé : format 24 heures|オフの場合は24時間表示|关闭时使用 24 小时制
Номера недель|Week numbers|주 번호|Numéros de semaine|週番号|周数
В основном календаре|In the main calendar|기본 캘린더에 표시|Dans le calendrier principal|メインカレンダーに表示|在主日历中显示
Показывать выходные|Show weekends|주말 표시|Afficher les week-ends|週末を表示|显示周末
В видах месяца и недели. Виджет всегда показывает 7 дней.|In month and week views. Widgets always show all 7 days.|월 및 주 보기에서 적용됩니다. 위젯은 항상 7일을 표시합니다.|Dans les vues mois et semaine. Les widgets affichent toujours 7 jours.|月表示と週表示に適用。ウィジェットは常に7日間を表示します。|用于月视图和周视图。小组件始终显示 7 天。
Запуск вместе с Windows|Start with Windows|Windows 시작 시 실행|Démarrer avec Windows|Windows起動時に実行|随 Windows 启动
Настройки сохраняются автоматически.|Settings are saved automatically.|설정은 자동으로 저장됩니다.|Les paramètres sont enregistrés automatiquement.|設定は自動的に保存されます。|设置会自动保存。
Пароль приложения|App-specific password|앱 전용 암호|Mot de passe pour application|アプリ用パスワード|应用专用密码
Подключить iCloud|Connect iCloud|iCloud 연결|Connecter iCloud|iCloudに接続|连接 iCloud
Подключение…|Connecting…|연결 중…|Connexion…|接続中…|连接中…
Открыть Apple Account ↗|Open Apple Account ↗|Apple Account 열기 ↗|Ouvrir Apple Account ↗|Apple Accountを開く ↗|打开 Apple Account ↗
Отключить|Disconnect|연결 해제|Déconnecter|接続解除|断开连接
Отключить iCloud?|Disconnect iCloud?|iCloud 연결을 해제할까요?|Déconnecter iCloud ?|iCloudとの接続を解除しますか？|断开 iCloud 连接？
Синхронизировать сейчас|Sync now|지금 동기화|Synchroniser maintenant|今すぐ同期|立即同步
Последняя синхронизация:|Last synced:|마지막 동기화:|Dernière synchronisation :|最終同期：|上次同步：
Первое обновление ещё не завершено|Initial sync is not finished yet|첫 동기화가 아직 완료되지 않았습니다|La première synchronisation n’est pas terminée|初回の同期はまだ完了していません|首次同步尚未完成
Изменений в очереди:|Queued changes:|대기 중인 변경 사항:|Modifications en attente :|保留中の変更：|待同步更改：
Частота синхронизации|Sync interval|동기화 간격|Fréquence de synchronisation|同期間隔|同步频率
Также обновляется после сохранения события|Also syncs after saving an event|일정을 저장한 후에도 동기화됩니다|Synchronise aussi après l’enregistrement d’un événement|予定の保存後にも同期します|保存日程后也会同步
Каждые {n} мин.|Every {n} min|{n}분마다|Toutes les {n} min|{n}分ごと|每 {n} 分钟
Оставить iCloud|Keep iCloud version|iCloud 버전 유지|Garder la version iCloud|iCloudの版を保持|保留 iCloud 版本
Оставить мою версию|Keep my version|내 버전 유지|Garder ma version|自分の版を保持|保留我的版本
В iCloud|In iCloud|iCloud에서|Dans iCloud|iCloud側|在 iCloud 中
Удалено|Deleted|삭제됨|Supprimé|削除済み|已删除
Все конфликты разрешены|All conflicts resolved|모든 충돌이 해결되었습니다|Tous les conflits sont résolus|すべての競合を解決しました|所有冲突均已解决
Пока вы редактировали событие, его версия в iCloud изменилась. Выберите версию для каждого события.|The iCloud version changed while you were editing. Choose which version to keep for each event.|일정을 수정하는 동안 iCloud 버전이 변경되었습니다. 각 일정에서 유지할 버전을 선택하세요.|La version iCloud a changé pendant votre modification. Choisissez la version à garder pour chaque événement.|編集中にiCloud側の予定が変更されました。各予定で保持する版を選んでください。|您编辑时，iCloud 中的日程发生了变化。请选择每个日程要保留的版本。
На iPhone включите «Настройки → ваше имя → iCloud → Календарь». Создайте пароль приложения в Apple Account с включённой двухфакторной аутентификацией и введите его здесь.|On iPhone, enable Settings → your name → iCloud → Calendar. With two-factor authentication enabled, create an app-specific password in Apple Account and enter it here.|iPhone에서 설정 → 사용자 이름 → iCloud → 캘린더를 켜세요. 이중 인증을 활성화한 Apple Account에서 앱 전용 암호를 생성하고 여기에 입력하세요.|Sur iPhone, activez Réglages → votre nom → iCloud → Calendrier. Activez l’authentification à deux facteurs, créez un mot de passe pour application dans Apple Account et saisissez-le ici.|iPhoneの設定 → 自分の名前 → iCloud → カレンダーを有効にしてください。2ファクタ認証を有効にしたApple Accountでアプリ用パスワードを作成し、ここに入力してください。|在 iPhone 上启用“设置 → 您的姓名 → iCloud → 日历”。开启双重认证后，在 Apple Account 中创建应用专用密码并在此输入。
Пароль хранится локально и шифруется средствами Windows. TimeLife обращается напрямую к iCloud. События календаря «На компьютере» остаются локальными.|Your password is stored locally and encrypted by Windows. TimeLife connects directly to iCloud. Events in the local calendar stay on this computer.|암호는 로컬에 저장되며 Windows에서 암호화됩니다. TimeLife는 iCloud에 직접 연결됩니다. 로컬 캘린더의 일정은 이 컴퓨터에만 저장됩니다.|Le mot de passe est stocké localement et chiffré par Windows. TimeLife se connecte directement à iCloud. Les événements du calendrier local restent sur cet ordinateur.|パスワードはローカルに保存され、Windowsで暗号化されます。TimeLifeはiCloudに直接接続します。ローカルカレンダーの予定はこのコンピューターに保存されます。|密码保存在本地并由 Windows 加密。TimeLife 直接连接 iCloud。本地日历中的日程仅保存在此电脑上。
Сохранённый пароль и копии синхронизированных событий будут удалены с компьютера. События в iCloud и локальный календарь останутся.|The saved password and synced copies will be removed from this computer. iCloud events and the local calendar will remain.|저장된 암호와 동기화된 일정 사본이 컴퓨터에서 삭제됩니다. iCloud 일정과 로컬 캘린더는 유지됩니다.|Le mot de passe enregistré et les copies synchronisées seront supprimés de cet ordinateur. Les événements iCloud et le calendrier local seront conservés.|保存したパスワードと同期した予定のコピーをコンピューターから削除します。iCloudの予定とローカルカレンダーは残ります。|将从此电脑删除保存的密码和同步日程的副本。iCloud 中的日程和本地日历会保留。
Это событие доступно только для просмотра. При конфликте сначала выберите версию в основном окне.|This event is read-only. For a conflict, first choose a version in the main window.|이 일정은 읽기 전용입니다. 충돌이 있으면 먼저 기본 창에서 버전을 선택하세요.|Cet événement est en lecture seule. En cas de conflit, choisissez d’abord une version dans la fenêtre principale.|この予定は読み取り専用です。競合している場合は、まずメイン画面で版を選んでください。|此日程为只读。如存在冲突，请先在主窗口选择版本。
Нет календаря с правом создания событий. Проверьте доступ к календарям iCloud.|No writable calendar is available. Check your iCloud calendar permissions.|일정을 추가할 수 있는 캘린더가 없습니다. iCloud 캘린더 권한을 확인하세요.|Aucun calendrier modifiable. Vérifiez les droits des calendriers iCloud.|予定を作成できるカレンダーがありません。iCloudカレンダーの権限を確認してください。|没有可创建日程的日历。请检查 iCloud 日历权限。
Не удалось отобразить {count} событий. Исходные данные сохранены: {message}|Could not display {count} events. Original data preserved: {message}|일정 {count}개를 표시할 수 없습니다. 원본 데이터는 보존되었습니다: {message}|Impossible d’afficher {count} événements. Données d’origine conservées : {message}|{count}件の予定を表示できません。元のデータは保持されています：{message}|无法显示 {count} 个日程。原始数据已保留：{message}
Нет связи с iCloud. Изменения сохранены на компьютере и будут отправлены при восстановлении связи.|Cannot reach iCloud. Changes are saved locally and will be sent when the connection returns.|iCloud에 연결할 수 없습니다. 변경 사항은 로컬에 저장되었으며 연결이 복구되면 전송됩니다.|iCloud est inaccessible. Les modifications sont enregistrées localement et seront envoyées au rétablissement de la connexion.|iCloudに接続できません。変更はローカルに保存され、接続が回復すると送信されます。|无法连接 iCloud。更改已保存在本地，连接恢复后会上传。
Не удалось прочитать сохранённый пароль. Подключите iCloud заново.|Could not read the saved password. Reconnect iCloud.|저장된 암호를 읽을 수 없습니다. iCloud를 다시 연결하세요.|Impossible de lire le mot de passe enregistré. Reconnectez iCloud.|保存したパスワードを読み取れません。iCloudに再接続してください。|无法读取保存的密码。请重新连接 iCloud。
Получен неполный ответ iCloud; локальные события сохранены|Incomplete iCloud response; local events preserved|iCloud 응답이 불완전합니다. 로컬 일정은 보존되었습니다|Réponse iCloud incomplète ; événements locaux conservés|iCloudの応答が不完全です。ローカルの予定は保持されています|iCloud 响应不完整；本地日程已保留
Получен повреждённый ответ iCloud; локальные события сохранены|Invalid iCloud response; local events preserved|iCloud 응답이 잘못되었습니다. 로컬 일정은 보존되었습니다|Réponse iCloud invalide ; événements locaux conservés|iCloudの応答が無効です。ローカルの予定は保持されています|iCloud 响应无效；本地日程已保留
Получен неожиданный ответ iCloud; локальные события сохранены|Unexpected iCloud response; local events preserved|예상치 못한 iCloud 응답입니다. 로컬 일정은 보존되었습니다|Réponse iCloud inattendue ; événements locaux conservés|予期しないiCloudの応答です。ローカルの予定は保持されています|收到意外的 iCloud 响应；本地日程已保留
iCloud не подтвердил доступ к календарю; локальные события сохранены|iCloud did not confirm calendar access; local events preserved|iCloud에서 캘린더 접근을 확인하지 못했습니다. 로컬 일정은 보존되었습니다|iCloud n’a pas confirmé l’accès au calendrier ; événements locaux conservés|iCloudがカレンダーへのアクセスを確認できません。ローカルの予定は保持されています|iCloud 未确认日历访问权限；本地日程已保留
iCloud отклонил доступ. Проверьте Apple Account, пароль приложения и права календаря.|iCloud denied access. Check your Apple Account, app-specific password and calendar permissions.|iCloud에서 접근을 거부했습니다. Apple Account, 앱 전용 암호 및 캘린더 권한을 확인하세요.|iCloud a refusé l’accès. Vérifiez Apple Account, le mot de passe pour application et les droits du calendrier.|iCloudがアクセスを拒否しました。Apple Account、アプリ用パスワード、カレンダーの権限を確認してください。|iCloud 拒绝访问。请检查 Apple Account、应用专用密码和日历权限。
Введите Apple Account и пароль приложения|Enter your Apple Account and app-specific password|Apple Account와 앱 전용 암호를 입력하세요|Saisissez Apple Account et le mot de passe pour application|Apple Accountとアプリ用パスワードを入力してください|请输入 Apple Account 和应用专用密码
Сначала отключите текущий аккаунт|Disconnect the current account first|먼저 현재 계정의 연결을 해제하세요|Déconnectez d’abord le compte actuel|まず現在のアカウントを接続解除してください|请先断开当前账户
Сначала синхронизируйте изменения и разрешите конфликты|Sync changes and resolve conflicts first|먼저 변경 사항을 동기화하고 충돌을 해결하세요|Synchronisez les modifications et résolvez les conflits d’abord|まず変更を同期し、競合を解決してください|请先同步更改并解决冲突
Календарь доступен только для чтения|This calendar is read-only|이 캘린더는 읽기 전용입니다|Ce calendrier est en lecture seule|このカレンダーは読み取り専用です|此日历为只读
Сначала разрешите конфликт события|Resolve the event conflict first|먼저 일정 충돌을 해결하세요|Résolvez d’abord le conflit de l’événement|まず予定の競合を解決してください|请先解决日程冲突
Событие уже удалено на другом устройстве|The event was deleted on another device|다른 기기에서 일정이 삭제되었습니다|L’événement a été supprimé sur un autre appareil|別のデバイスで予定が削除されました|此日程已在其他设备上删除
Событие изменилось после открытия редактора. Откройте его заново.|The event has changed. Reopen the editor.|일정이 변경되었습니다. 편집기를 다시 여세요.|L’événement a changé. Rouvrez l’éditeur.|予定が変更されました。編集画面を開き直してください。|日程已更改。请重新打开编辑器。
Событие уже изменено в другом окне. Откройте его заново.|The event was changed in another window. Reopen it.|다른 창에서 일정이 변경되었습니다. 다시 여세요.|L’événement a changé dans une autre fenêtre. Rouvrez-le.|別のウィンドウで予定が変更されました。開き直してください。|日程已在其他窗口更改。请重新打开。
Событие уже удалено|The event was already deleted|일정이 이미 삭제되었습니다|L’événement a déjà été supprimé|予定はすでに削除されています|此日程已被删除
Удаление приглашений пока недоступно: измените событие в iCloud|Invitation deletion is not supported yet; edit the event in iCloud|초대 삭제는 아직 지원되지 않습니다. iCloud에서 일정을 수정하세요|La suppression d’invitations n’est pas disponible ; modifiez l’événement dans iCloud|招待の削除は未対応です。iCloudで予定を変更してください|暂不支持删除邀请；请在 iCloud 中编辑日程
Редактирование приглашений пока недоступно: измените событие в iCloud|Invitation editing is not supported yet; edit the event in iCloud|초대 수정은 아직 지원되지 않습니다. iCloud에서 일정을 수정하세요|La modification d’invitations n’est pas disponible ; modifiez l’événement dans iCloud|招待の編集は未対応です。iCloudで予定を変更してください|暂不支持编辑邀请；请在 iCloud 中编辑日程
Событие отправлено; ожидаем подтверждения iCloud|Event sent; waiting for iCloud confirmation|일정이 전송되었습니다. iCloud 확인을 기다리는 중입니다|Événement envoyé ; confirmation iCloud en attente|予定を送信しました。iCloudの確認を待っています|日程已发送；正在等待 iCloud 确认
Конфликт уже разрешён|The conflict was already resolved|충돌이 이미 해결되었습니다|Le conflit est déjà résolu|競合はすでに解決されています|冲突已解决
Неизвестный способ разрешения конфликта|Unknown conflict resolution method|알 수 없는 충돌 해결 방법|Méthode de résolution inconnue|不明な競合解決方法|未知的冲突解决方式
Некорректная дата или часовой пояс|Invalid date or time zone|잘못된 날짜 또는 시간대|Date ou fuseau horaire invalide|日付またはタイムゾーンが無効です|日期或时区无效
Такого времени нет из-за перевода часов|This time does not exist due to a daylight saving change|서머타임 변경으로 이 시간이 존재하지 않습니다|Cette heure n’existe pas en raison du changement d’heure|夏時間への切り替えにより、この時刻は存在しません|由于夏令时变更，此时间不存在
Слишком много повторений для отображения|Too many occurrences to display|표시할 반복 일정이 너무 많습니다|Trop d’occurrences à afficher|繰り返しが多すぎるため表示できません|重复日程过多，无法显示
Укажите название события|Enter an event title|일정 제목을 입력하세요|Saisissez un titre|予定のタイトルを入力してください|请输入日程标题
Конец события должен быть позже начала|The end must be after the start|종료 시간은 시작 시간보다 늦어야 합니다|La fin doit être après le début|終了は開始より後にしてください|结束时间必须晚于开始时间
Некорректное правило повторения|Invalid recurrence rule|잘못된 반복 규칙|Règle de répétition invalide|繰り返しルールが無効です|重复规则无效
Это событие нельзя удалить в TimeLife|This event cannot be deleted in TimeLife|TimeLife에서 이 일정을 삭제할 수 없습니다|Cet événement ne peut pas être supprimé dans TimeLife|この予定はTimeLifeで削除できません|无法在 TimeLife 中删除此日程
Недопустимый адрес сервера iCloud|Invalid iCloud server address|잘못된 iCloud 서버 주소|Adresse du serveur iCloud invalide|iCloudサーバーのアドレスが無効です|iCloud 服务器地址无效
iCloud не вернул адрес календарей|iCloud did not return a calendar address|iCloud에서 캘린더 주소를 반환하지 않았습니다|iCloud n’a pas renvoyé d’adresse de calendrier|iCloudがカレンダーのアドレスを返しませんでした|iCloud 未返回日历地址
iCloud не вернул полный список событий|iCloud did not return the full event list|iCloud에서 전체 일정 목록을 반환하지 않았습니다|iCloud n’a pas renvoyé la liste complète des événements|iCloudが予定の完全な一覧を返しませんでした|iCloud 未返回完整日程列表
Не удалось найти календарь этого Apple Account|No calendar found for this Apple Account|이 Apple Account의 캘린더를 찾을 수 없습니다|Aucun calendrier trouvé pour cet Apple Account|このApple Accountのカレンダーが見つかりません|未找到此 Apple Account 的日历
Слишком много перенаправлений iCloud|Too many iCloud redirects|iCloud 리디렉션이 너무 많습니다|Trop de redirections iCloud|iCloudのリダイレクトが多すぎます|iCloud 重定向次数过多
Нет версии для безопасного удаления|No version available for safe deletion|안전하게 삭제할 버전 정보가 없습니다|Aucune version pour une suppression sûre|安全に削除するための版情報がありません|缺少可安全删除的版本信息
Windows не предоставила защищённое хранилище пароля|Windows secure password storage is unavailable|Windows 보안 암호 저장소를 사용할 수 없습니다|Le stockage sécurisé Windows est indisponible|Windowsの安全なパスワード保存機能を利用できません|Windows 安全密码存储不可用
Повреждено хранилище TimeLife|TimeLife storage is damaged|TimeLife 저장소가 손상되었습니다|Le stockage TimeLife est endommagé|TimeLifeの保存データが破損しています|TimeLife 存储已损坏
Некорректные настройки|Invalid settings|잘못된 설정|Paramètres invalides|設定が無効です|设置无效
Некорректный часовой пояс или начало недели|Invalid time zone or first day of week|잘못된 시간대 또는 주 시작일|Fuseau ou premier jour de semaine invalide|タイムゾーンまたは週の開始日が無効です|时区或每周第一天无效
Некорректная прозрачность|Invalid opacity|잘못된 불투명도|Opacité invalide|不透明度が無効です|不透明度无效
Некорректный интервал обновления|Invalid sync interval|잘못된 동기화 간격|Intervalle de synchronisation invalide|同期間隔が無効です|同步间隔无效
Некорректный список календарей|Invalid calendar list|잘못된 캘린더 목록|Liste de calendriers invalide|カレンダー一覧が無効です|日历列表无效
Некорректный диапазон дат|Invalid date range|잘못된 날짜 범위|Période invalide|日付範囲が無効です|日期范围无效
Недопустимый источник запроса|Invalid request source|잘못된 요청 출처|Source de requête invalide|リクエスト元が無効です|请求来源无效
Некорректный язык|Invalid language|잘못된 언어|Langue invalide|言語が無効です|语言无效
Проверка сборки|Build check|빌드 확인|Vérification de version|ビルド確認|构建检查
`;
  const catalog = Object.create(null);
  for (const line of rows.trim().split('\n')) {
    const [key, ...values] = line.split('|');
    if (values.length !== 5 || values.some(v => !v)) throw new Error(`Invalid translation: ${key}`);
    catalog[key] = Object.fromEntries(['en', 'ko', 'fr', 'ja', 'zh'].map((lang, i) => [lang, values[i]]));
  }
  const aliases = {
    'Сначала разрешите конфликт': 'Сначала разрешите конфликт события',
    'Событие изменилось. Откройте его заново.': 'Событие изменилось после открытия редактора. Откройте его заново.',
    'Событие уже изменено в другом окне': 'Событие уже изменено в другом окне. Откройте его заново.',
    'Некорректная настройка': 'Некорректные настройки'
  };
  for (const [key, target] of Object.entries(aliases)) catalog[key] = catalog[target];
  function translate(key, language = 'ru', values = {}) {
    let text = language === 'ru' ? key : catalog[key]?.[language] || key;
    return text.replace(/\{(\w+)\}/g, (match, name) => values[name] === undefined ? match : String(values[name]));
  }
  const api = { languages, locales, catalog, translate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CalendarUI18n = api;
})(globalThis);
